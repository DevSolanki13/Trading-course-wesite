-- Finite course access. Review the one-calendar-month legacy backfill before shared rollout.
alter table public.courses add column access_period integer not null default 1 check(access_period between 1 and 3650),
 add column access_unit text not null default 'months' check(access_unit in('days','months'));
alter table public.enrollments add column expires_at timestamptz;

create function public.course_access_end(p_start timestamptz,p_period integer,p_unit text)returns timestamptz
language sql immutable set search_path='' as $$
 select ((p_start at time zone 'UTC') + case when p_unit='months' then make_interval(months=>p_period) else make_interval(days=>p_period) end) at time zone 'UTC';
$$;
-- Existing paid/refunded snapshots are immutable. Orders created before this
-- migration use the documented one-month backfill without rewriting receipts.
update public.enrollments e set expires_at=public.course_access_end(coalesce(o.paid_at,e.granted_at),c.access_period,c.access_unit)
 from public.courses c,public.orders o where e.course_id=c.id and e.order_id=o.id;
update public.enrollments e set expires_at=public.course_access_end(e.granted_at,c.access_period,c.access_unit)
 from public.courses c where e.course_id=c.id and e.expires_at is null;
alter table public.enrollments alter column expires_at set not null;
create index enrollment_expiry_idx on public.enrollments(user_id,course_id,expires_at)where active;

create function public.course_access_order_snapshot()returns trigger
language plpgsql set search_path='' as $$
begin
 new.course_snapshot:=coalesce(new.course_snapshot,'{}'::jsonb)||(select jsonb_build_object('access_period',c.access_period,'access_unit',c.access_unit)from public.courses c where c.id=new.course_id);
 return new;
end;$$;
create trigger course_access_snapshot before insert on public.orders for each row execute function public.course_access_order_snapshot();

create function public.course_access_grant()returns trigger
language plpgsql set search_path='' as $$
declare snapshot jsonb; started timestamptz; period integer; unit text;
begin
 if new.expires_at is not null then return new;end if;
 if new.order_id is not null then
   select o.course_snapshot,coalesce(o.paid_at,new.granted_at)into snapshot,started from public.orders o where o.id=new.order_id;
   period:=coalesce((snapshot->>'access_period')::integer,1);unit:=coalesce(snapshot->>'access_unit','months');
 else
   select c.access_period,c.access_unit into period,unit from public.courses c where c.id=new.course_id;started:=new.granted_at;
 end if;
 if period is null or period<1 or unit not in('days','months')or unit is null then raise exception 'Course access period unavailable'using errcode='22023';end if;
 new.expires_at:=public.course_access_end(started,period,unit);return new;
end;$$;
create trigger course_access_grant before insert on public.enrollments for each row execute function public.course_access_grant();
create or replace function public.purchase_has_access(p_user uuid,p_course uuid)returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from public.profiles where id=p_user and not blocked)and exists(
 select 1 from public.enrollments e left join public.orders o on o.id=e.order_id
 where e.user_id=p_user and e.course_id=p_course and e.active and e.revoked_at is null and e.expires_at>now()
 and(e.source='manual'or(o.status='paid'and o.user_id=p_user and o.course_id=p_course)));
$$;
create or replace function public.purchase_catalog(p_user uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'title',c.title,'description',c.description,
 'price',coalesce(c.sale_price_paise,c.price_paise),'currency','INR','level',c.level,'language',c.language,'thumbnail',c.thumbnail_url,
 'accessPeriod',c.access_period,'accessUnit',c.access_unit,'accessExpiresAt',(select max(e.expires_at)from public.enrollments e left join public.orders o on o.id=e.order_id where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null and(e.source='manual'or(o.status='paid'and o.user_id=p_user and o.course_id=c.id))),'owned',public.purchase_has_access(p_user,c.id),'progress',coalesce((select round(100.0*count(*)filter(where lp.completed)/nullif(count(*),0))
 from public.modules m join public.lessons l on l.module_id=m.id and l.published left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user where m.course_id=c.id),0),
 'modules',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'lessons',coalesce((select jsonb_agg(jsonb_build_object(
 'id',l.id,'title',l.title,'duration',l.duration_seconds,'preview',l.is_preview,'completed',coalesce(lp.completed,false))order by l.position)
 from public.lessons l left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user where l.module_id=m.id and l.published),'[]'::jsonb))order by m.position)
 from public.modules m where m.course_id=c.id),'[]'::jsonb))order by c.created_at),'[]'::jsonb)from public.courses c where c.status='published';
$$;
create or replace function public.purchase_read(p_action text,p_user uuid,p_ref text default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; c uuid;l public.lessons;
begin
 if p_action='catalog' then return public.purchase_catalog(p_user);end if;
 if p_action='course'then select value into result from jsonb_array_elements(public.purchase_catalog(p_user))where value->>'slug'=p_ref or value->>'id'=p_ref;return result;end if;
 if p_action='lesson'then
   select * into l from public.lessons where id=p_ref::uuid and published;
   select m.course_id into c from public.modules m join public.courses cs on cs.id=m.course_id and cs.status='published'where m.id=l.module_id;
   if l.id is null or c is null or(not l.is_preview and not public.purchase_has_access(p_user,c))then raise exception 'Purchase to unlock'using errcode='42501';end if;
   select jsonb_build_object('id',l.id,'title',l.title,'duration',l.duration_seconds,'preview',l.is_preview,'completed',coalesce(lp.completed,false),
    'content',coalesce(pc.content,la.notes,''),'videoUrl',case when pc.is_demo then pc.demo_video_url else null end,'isDemo',coalesce(pc.is_demo,false))into result
   from(select 1)x left join public.purchase_lesson_content pc on pc.lesson_id=l.id left join public.lesson_assets la on la.lesson_id=l.id
   left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user;return result;
 end if;
 if p_user is null then raise exception 'Sign in required'using errcode='42501';end if;
 if p_action in('orders','order')then
   select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'courseId',o.course_id,'slug',coalesce(o.course_snapshot->>'slug',c.slug),
   'courseTitle',coalesce(o.course_snapshot->>'title',c.title),'userId',o.user_id,'amount',o.total_paise,'base',o.base_paise,'tax',o.tax_paise,
   'accessPeriod',coalesce((o.course_snapshot->>'access_period')::integer,1),'accessUnit',coalesce(o.course_snapshot->>'access_unit','months'),'accessExpiresAt',(select e.expires_at from public.enrollments e where e.order_id=o.id),'currency',o.currency,'status',o.status,'provider',o.purchase_provider,'providerOrderId',o.provider_order_id,'createdAt',o.created_at,'paidAt',o.paid_at)order by o.created_at desc),'[]'::jsonb)
   into result from public.orders o join public.courses c on c.id=o.course_id where o.user_id=p_user and o.purchase_provider is not null and(p_action='orders'or o.id::text=p_ref);
   if p_action='order'then return result->0;end if;return result;
 end if;
 raise exception 'Unknown purchase resource'using errcode='22023';
end;$$;
create or replace function public.learning_can_access(p_user uuid,p_session uuid,p_lesson uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.auth_has_session(p_user,p_session) and exists(
 select 1 from public.lessons l join public.modules m on m.id=l.module_id
 join public.courses c on c.id=m.course_id
 where l.id=p_lesson and l.published and c.status='published' and l.duration_seconds between 1 and 86400
 and (l.is_preview or exists(select 1 from public.enrollments e
 left join public.orders o on o.id=e.order_id
 where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null and e.expires_at>clock_timestamp()
 and (e.source='manual' or (o.status='paid' and o.user_id=p_user and o.course_id=c.id)))));
$$;
create or replace function public.admin_mutate(p_actor uuid,p_session uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare r text;target uuid;course_id uuid;current_version integer;result jsonb:='{}';rec record;
 c public.courses;request public.refund_requests;evidence jsonb;setting public.site_settings;newstate text;
begin
 r:=public.admin_guard(p_actor,p_session,p_action not in('grant','refund_decide'));
 if p_action in('course_save','course_state','module_save','lesson_save','reorder') then
   course_id:=nullif(p_data->>'courseId','')::uuid;
   if course_id is not null then
     select * into c from public.courses where id=course_id for update;
     if not found then raise exception 'Course missing' using errcode='22023';end if;
     if c.version<>(p_data->>'version')::integer then raise exception 'Version conflict' using errcode='40001';end if;
   end if;
 end if;
 case p_action
 when 'course_save' then
   if course_id is null then
     insert into public.courses(slug,title,description,price_paise,sale_price_paise,level,language,thumbnail_url,outcomes,audience,prerequisites,artwork,access_period,access_unit)
     values(p_data->>'slug',p_data->>'title',p_data->>'description',(p_data->>'price_paise')::integer,nullif(p_data->>'sale_price_paise','')::integer,p_data->>'level',p_data->>'language',nullif(p_data->>'thumbnail_url',''),p_data->'outcomes',p_data->>'audience',p_data->>'prerequisites',p_data->>'artwork',coalesce((p_data->>'access_period')::integer,1),coalesce(p_data->>'access_unit','months'))returning id into course_id;
   else
     update public.courses set title=p_data->>'title',slug=p_data->>'slug',description=p_data->>'description',price_paise=(p_data->>'price_paise')::integer,
     sale_price_paise=nullif(p_data->>'sale_price_paise','')::integer,level=p_data->>'level',language=p_data->>'language',thumbnail_url=nullif(p_data->>'thumbnail_url',''),
     outcomes=p_data->'outcomes',audience=p_data->>'audience',prerequisites=p_data->>'prerequisites',artwork=p_data->>'artwork',access_period=coalesce((p_data->>'access_period')::integer,c.access_period),access_unit=coalesce(p_data->>'access_unit',c.access_unit),version=version+1,updated_at=now() where id=course_id;
   end if;target:=course_id;
 when 'course_state' then
   if p_data->>'status'='published' and not exists(select 1 from public.lessons l join public.modules m on m.id=l.module_id where m.course_id=course_id and l.published) then raise exception 'Publish lessons first' using errcode='22023';end if;
   update public.courses set status=p_data->>'status',version=version+1,updated_at=now()where id=course_id;target:=course_id;
 when 'module_save' then
   target:=nullif(p_data->>'id','')::uuid;
   if target is null then insert into public.modules(course_id,title,position)select course_id,p_data->>'title',coalesce(max(m.position)+1,0)from public.modules m where m.course_id=course_id returning id into target;
   else update public.modules m set title=p_data->>'title' where m.id=target and m.course_id=course_id;if not found then raise exception 'Module mismatch' using errcode='22023';end if;end if;
   update public.courses set version=version+1,updated_at=now()where id=course_id;
 when 'lesson_save' then
   perform 1 from public.modules m where m.id=(p_data->>'moduleId')::uuid and m.course_id=course_id;
   if not found then raise exception 'Module mismatch' using errcode='22023';end if;
   target:=nullif(p_data->>'id','')::uuid;
   if target is null then
     insert into public.lessons(module_id,title,position,duration_seconds,is_preview,published)
     select (p_data->>'moduleId')::uuid,p_data->>'title',coalesce(max(l.position)+1,0),(p_data->>'duration_seconds')::integer,(p_data->>'is_preview')::boolean,(p_data->>'published')::boolean
     from public.lessons l where l.module_id=(p_data->>'moduleId')::uuid returning id into target;
   else
     perform 1 from public.lessons l where l.id=target and l.module_id=(p_data->>'moduleId')::uuid;
     if not found then raise exception 'Lesson mismatch' using errcode='22023';end if;
     if exists(select 1 from public.lesson_progress where lesson_id=target) and exists(select 1 from public.lesson_assets a join public.lessons l on l.id=a.lesson_id where a.lesson_id=target and (a.provider_video_id is distinct from p_data->>'videoId' or l.duration_seconds<>(p_data->>'duration_seconds')::integer or l.is_preview is distinct from (p_data->>'is_preview')::boolean)) then
       raise exception 'Consumed video version is immutable; add a new lesson instead' using errcode='22023';end if;
     update public.lessons set title=p_data->>'title',duration_seconds=(p_data->>'duration_seconds')::integer,is_preview=(p_data->>'is_preview')::boolean,published=(p_data->>'published')::boolean where id=target;
   end if;
   insert into public.lesson_assets(lesson_id,provider_video_id,notes,provider_status,verified_at,verified_duration)
   values(target,coalesce(p_data->>'videoId',''),p_data->>'notes',p_data->>'provider_status',case when p_data->>'provider_status'='ready' then now()else null end,nullif(p_data->>'verified_duration','')::integer)
   on conflict(lesson_id)do update set provider_video_id=excluded.provider_video_id,notes=excluded.notes,provider_status=excluded.provider_status,verified_at=excluded.verified_at,verified_duration=excluded.verified_duration;
   delete from public.lesson_resources where lesson_id=target;
   for rec in select value,ordinality from jsonb_array_elements(coalesce(p_data->'resources','[]'))with ordinality loop
     insert into public.lesson_resources(lesson_id,title,content,position)values(target,rec.value->>'title',rec.value->>'content',rec.ordinality-1);
   end loop;
   update public.courses set version=version+1,updated_at=now()where id=course_id;
 when 'reorder' then
   if p_data->>'kind'='modules' then
     if (select count(*)from public.modules m where m.course_id=course_id)<>jsonb_array_length(p_data->'ids') or exists(select 1 from jsonb_array_elements_text(p_data->'ids')v where not exists(select 1 from public.modules m where m.id=v::uuid and m.course_id=course_id)) then raise exception 'Incomplete order' using errcode='22023';end if;
     update public.modules m set position=m.position+100000 where m.course_id=course_id;
     for rec in select value,ordinality from jsonb_array_elements_text(p_data->'ids')with ordinality loop update public.modules set position=rec.ordinality-1 where id=rec.value::uuid;end loop;
   else
     perform 1 from public.modules m where m.id=(p_data->>'moduleId')::uuid and m.course_id=course_id;if not found then raise exception 'Module mismatch' using errcode='22023';end if;
     if (select count(*)from public.lessons where module_id=(p_data->>'moduleId')::uuid)<>jsonb_array_length(p_data->'ids') or exists(select 1 from jsonb_array_elements_text(p_data->'ids')v where not exists(select 1 from public.lessons l where l.id=v::uuid and l.module_id=(p_data->>'moduleId')::uuid)) then raise exception 'Incomplete order' using errcode='22023';end if;
     update public.lessons set position=position+100000 where module_id=(p_data->>'moduleId')::uuid;
     for rec in select value,ordinality from jsonb_array_elements_text(p_data->'ids')with ordinality loop update public.lessons set position=rec.ordinality-1 where id=rec.value::uuid;end loop;
   end if;
   target:=course_id;update public.courses set version=version+1,updated_at=now()where id=course_id;
 when 'grant' then
   target:=(p_data->>'userId')::uuid;course_id:=(p_data->>'courseId')::uuid;
   perform 1 from public.profiles where id=target for update;if not found then raise exception 'User missing' using errcode='22023';end if;
   perform 1 from public.courses where id=course_id and status='published';if not found then raise exception 'Publish course first' using errcode='22023';end if;
   if not exists(select 1 from public.enrollments e where e.user_id=target and e.course_id=course_id and e.source='manual' and e.active and e.revoked_at is null and e.expires_at>now())then
   insert into public.enrollments(user_id,course_id,source)values(target,course_id,'manual');end if;
 when 'revoke' then
   target:=(p_data->>'enrollmentId')::uuid;
   update public.enrollments set active=false,revoked_at=now()where id=target and active and revoked_at is null;
   if not found then raise exception 'Enrollment missing' using errcode='22023';end if;
 when 'block','logout_student' then
   target:=(p_data->>'userId')::uuid;
   perform 1 from public.profiles where id=target and role='student' for update;if not found then raise exception 'Only student accounts can be changed here' using errcode='22023';end if;
   if p_action='block' then update public.profiles set blocked=(p_data->>'blocked')::boolean where id=target;end if;
   if p_action='logout_student' or coalesce((p_data->>'blocked')::boolean,false)then perform public.auth_revoke_devices(target,p_session,null,true);end if;
 when 'settings' then
   select * into setting from public.site_settings where id=true for update;
   if setting.version<>(p_data->>'version')::integer then raise exception 'Version conflict' using errcode='40001';end if;
   update public.site_settings set gst_enabled=(p_data->>'gst_enabled')::boolean,gst_rate_bps=(p_data->>'gst_rate_bps')::integer,gstin=nullif(p_data->>'gstin',''),
   device_limit=(p_data->>'device_limit')::integer,refund_window_days=(p_data->>'refund_window_days')::integer,refund_watch_limit_percent=(p_data->>'refund_watch_limit_percent')::integer,
   public_telegram_url=nullif(p_data->>'public_telegram_url',''),public_instagram_url=nullif(p_data->>'public_instagram_url',''),private_telegram_url=nullif(p_data->>'private_telegram_url',''),private_invite_expires_at=nullif(p_data->>'private_invite_expires_at','')::timestamptz,
   business_name=p_data->>'business_name',business_address=p_data->>'business_address',support_email=nullif(p_data->>'support_email',''),version=version+1,updated_at=now()where id=true;
   update public.device_sessions set revoked_at=now()where id in(
    select d.id from(select d.id,row_number()over(partition by d.user_id order by d.last_active_at desc,d.id)as position
    from public.device_sessions d join public.profiles p on p.id=d.user_id join auth.sessions a on a.id=d.auth_session_id
    where d.admitted_at is not null and d.revoked_at is null and d.expires_at>now()and a.created_at>p.sessions_invalid_before and(a.not_after is null or a.not_after>now()))d
    where d.position>(p_data->>'device_limit')::integer);
   result:=jsonb_build_object('saved',true);
 when 'content' then
   update public.site_content set document=p_data->'document',version=version+1,updated_at=now()where id=true and version=(p_data->>'version')::integer;
   if not found then raise exception 'Version conflict' using errcode='40001';end if;
 when 'coupon' then
   target:=nullif(p_data->>'id','')::uuid;
   if target is null then insert into public.coupons(code,kind,value,course_id,expires_at,total_limit,per_user_limit,active)
   values(p_data->>'code',p_data->>'kind',(p_data->>'value')::integer,nullif(p_data->>'courseId','')::uuid,nullif(p_data->>'expiresAt','')::timestamptz,nullif(p_data->>'totalLimit','')::integer,(p_data->>'perUserLimit')::integer,(p_data->>'active')::boolean)returning id into target;
   else update public.coupons set code=p_data->>'code',kind=p_data->>'kind',value=(p_data->>'value')::integer,course_id=nullif(p_data->>'courseId','')::uuid,expires_at=nullif(p_data->>'expiresAt','')::timestamptz,total_limit=nullif(p_data->>'totalLimit','')::integer,per_user_limit=(p_data->>'perUserLimit')::integer,active=(p_data->>'active')::boolean,version=version+1 where id=target and version=(p_data->>'version')::integer;if not found then raise exception 'Version conflict' using errcode='40001';end if;end if;
 when 'refund_decide' then
   target:=(p_data->>'id')::uuid;select * into request from public.refund_requests where id=target for update;
   if not found or request.state not in('requested','failed') or request.version<>(p_data->>'version')::integer then raise exception 'Refund already reviewed or stale' using errcode='40001';end if;
   perform 1 from public.orders where id=request.order_id and status='paid' for update;if not found then raise exception 'Paid order required' using errcode='22023';end if;evidence:=public.refund_evidence(request.order_id);
   if p_data->>'decision'='approve' and not coalesce((evidence->>'eligible')::boolean,false) and not(r='admin' and coalesce((p_data->>'goodwill')::boolean,false))then raise exception 'Current refund evidence is not eligible' using errcode='22023';end if;
   if coalesce((p_data->>'goodwill')::boolean,false)and r<>'admin' then raise exception 'Only Admin can override' using errcode='42501';end if;
   newstate:=case when p_data->>'decision'='approve' then 'approved'else 'rejected'end;
   update public.refund_requests set state=newstate,reviewed_evidence=evidence,review_note=p_data->>'note',reviewed_by=p_actor,goodwill=coalesce((p_data->>'goodwill')::boolean,false),version=version+1,updated_at=now()where id=target;
   insert into public.refund_decisions(request_id,actor_id,decision,note,evidence,goodwill)values(target,p_actor,newstate,p_data->>'note',evidence,coalesce((p_data->>'goodwill')::boolean,false));
   insert into public.notification_outbox(user_id,dedupe_key,subject,body)values(request.user_id,'refund:'||target||':'||newstate,'Refund request update','Your refund request is '||newstate||'. '||case when newstate='approved' then 'Payment-provider processing has not started; approval is not settlement.'else 'Review note: '||(p_data->>'note')end)on conflict(dedupe_key)do nothing;
 when 'goodwill_request' then
   perform 1 from public.orders where id=(p_data->>'orderId')::uuid and status='paid'for update;if not found then raise exception 'Paid order required'using errcode='22023';end if;
   evidence:=public.refund_evidence((p_data->>'orderId')::uuid);
   insert into public.refund_requests(order_id,user_id,reason,requested_evidence,goodwill)
   select id,user_id,p_data->>'note',evidence,true from public.orders where id=(p_data->>'orderId')::uuid
   on conflict(order_id)do nothing returning id into target;
   if target is null then raise exception 'Refund request already exists'using errcode='22023';end if;
 when 'task_done' then
   target:=(p_data->>'id')::uuid;update public.operations_tasks set state='done',note=p_data->>'note',completed_by=p_actor,completed_at=now()where id=target and state='open';if not found then raise exception 'Task unavailable'using errcode='22023';end if;
 else raise exception 'Unknown action'using errcode='22023';
 end case;
 insert into public.audit_log(actor_id,action,target_type,target_id,details)values(p_actor,p_action,'admin_operation',coalesce(target::text,course_id::text,'settings'),jsonb_build_object('note',p_data->>'note','courseId',course_id,'version',p_data->>'version'));
 return result||jsonb_build_object('id',coalesce(target,course_id),'courseId',course_id);
end;$$;
create or replace function public.demo_create_order(p_user uuid, p_session uuid, p_slug text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  c public.courses; s public.site_settings; o public.orders;
  base integer; tax integer; snapshot jsonb; new_id uuid;
begin
  perform 1 from public.profiles where id=p_user for update;
  if not public.auth_has_session(p_user,p_session) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  select * into c from public.courses where slug=p_slug and status='published' for share;
  if not found then raise exception 'Course unavailable' using errcode='22023'; end if;
  if exists(select 1 from public.enrollments e left join public.orders paid on paid.id=e.order_id
    where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null and e.expires_at>now()
    and (e.source='manual' or (paid.status='paid' and paid.user_id=p_user and paid.course_id=c.id))) then
    raise exception 'Already enrolled' using errcode='23505';
  end if;
  select * into o from public.orders where user_id=p_user and course_id=c.id
    and status='pending' and provider_order_id like 'demo_%' order by created_at desc limit 1;
  if found then return o.id; end if;
  select * into s from public.site_settings where id=true for share;
  if not found then raise exception 'Settings unavailable'; end if;
  select jsonb_build_object('slug',c.slug,'title',c.title,
    'duration_seconds',coalesce(sum(l.duration_seconds) filter(where not l.is_preview),0),
    'lessons',coalesce(jsonb_agg(jsonb_build_object('id',l.id,'duration_seconds',l.duration_seconds,
      'is_preview',l.is_preview) order by m.position,l.position) filter(where l.id is not null),'[]'::jsonb))
    into snapshot from public.modules m join public.lessons l on l.module_id=m.id and l.published
    where m.course_id=c.id;
  if jsonb_array_length(snapshot->'lessons')=0 then
    raise exception 'Course has no published lessons' using errcode='22023';
  end if;
  base := c.price_paise;
  tax := case when s.gst_enabled then floor(base::numeric*s.gst_rate_bps/10000)::integer else 0 end;
  new_id := gen_random_uuid();
  insert into public.orders(id,user_id,course_id,provider_order_id,base_paise,total_paise,
    gst_enabled,gst_rate_bps,tax_paise,idempotency_key,course_snapshot,refund_policy_snapshot)
    values(new_id,p_user,c.id,'demo_'||new_id,base,base+tax,s.gst_enabled,
      case when s.gst_enabled then s.gst_rate_bps else 0 end,tax,p_user||':'||c.id,snapshot,
      jsonb_build_object('window_days',s.refund_window_days,'watch_limit_percent',s.refund_watch_limit_percent));
  insert into public.payment_attempts(order_id,provider_payment_id,status,amount_paise)
    values(new_id,'demo_'||new_id,'created',base+tax);
  return new_id;
end;
$$;
create or replace function public.commerce_create_order(p_user uuid,p_session uuid,p_slug text,p_phone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.courses;s public.site_settings;o public.orders;new_id uuid;snapshot jsonb;base integer;tax integer;billing jsonb;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not public.auth_has_session(p_user,p_session) or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)
 then raise exception 'Verified session required' using errcode='42501';end if;
 if p_phone is null or p_phone!~'^[6-9][0-9]{9}$' then raise exception 'Valid phone required' using errcode='22023';end if;
 select * into c from public.courses where slug=p_slug and status='published' for share;
 if not found then raise exception 'Course unavailable' using errcode='22023';end if;
 if exists(select 1 from public.enrollments e left join public.orders paid on paid.id=e.order_id
 where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null and e.expires_at>now()
 and(e.source='manual' or(paid.status='paid' and paid.user_id=p_user and paid.course_id=c.id)))
 then raise exception 'Already enrolled' using errcode='23505';end if;
 select * into o from public.orders where user_id=p_user and course_id=c.id and status='pending'
 and provider_order_id like 'cf_sbx_%' order by created_at desc limit 1;
 if found then return o.id;end if;
 select * into s from public.site_settings where id=true for share;
 if not found then raise exception 'Settings unavailable';end if;
 -- Tax invoices require supplied customer/tax classification; until then this
 -- sandbox flow issues non-GST receipts only. No tax treatment is invented.
 if s.gst_enabled then raise exception 'GST invoice configuration requires approval' using errcode='22023';end if;
 select jsonb_build_object('slug',c.slug,'title',c.title,'version',c.version,
 'duration_seconds',coalesce(sum(l.duration_seconds)filter(where not l.is_preview),0),
 'lessons',coalesce(jsonb_agg(jsonb_build_object('id',l.id,'duration_seconds',l.duration_seconds,'is_preview',l.is_preview)
 order by m.position,l.position)filter(where l.id is not null),'[]'::jsonb)) into snapshot
 from public.modules m join public.lessons l on l.module_id=m.id and l.published where m.course_id=c.id;
 if jsonb_array_length(snapshot->'lessons')=0 or(snapshot->>'duration_seconds')::integer<=0 then raise exception 'Course has no paid lesson duration' using errcode='22023';end if;
 base:=coalesce(c.sale_price_paise,c.price_paise);tax:=0;
 if base<100 then raise exception 'Order must be at least INR 1' using errcode='22023';end if;
 billing:=jsonb_build_object('seller_name',s.business_name,'seller_address',s.business_address,'seller_gstin',s.gstin,
 'customer_name',(select full_name from public.profiles where id=p_user),
 'customer_email',(select email from auth.users where id=p_user),'customer_phone',p_phone);
 new_id:=gen_random_uuid();
 insert into public.orders(id,user_id,course_id,provider_order_id,base_paise,total_paise,gst_enabled,gst_rate_bps,tax_paise,
 idempotency_key,course_snapshot,billing_snapshot,refund_policy_snapshot)
 values(new_id,p_user,c.id,'cf_sbx_'||replace(new_id::text,'-',''),base,base+tax,false,0,tax,
 'cashfree:'||p_user||':'||c.id,snapshot,billing,
 jsonb_build_object('window_days',s.refund_window_days,'watch_limit_percent',s.refund_watch_limit_percent));
 insert into public.commerce_jobs(kind,target)values('payment','cf_sbx_'||replace(new_id::text,'-',''));
 return new_id;
end;$$;
revoke all on function public.course_access_end(timestamptz,integer,text),public.course_access_order_snapshot(),public.course_access_grant()from public,anon,authenticated;
grant execute on function public.course_access_end(timestamptz,integer,text)to service_role;
