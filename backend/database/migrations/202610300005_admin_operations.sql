-- Phase 5. Mutations and security audits commit atomically. Provider settlement stays separate.
alter table public.courses add column version integer not null default 1,
 add column outcomes jsonb not null default '[]', add column audience text not null default '',
 add column prerequisites text not null default '', add column artwork text not null default 'foundations';
alter table public.lesson_assets add column provider_status text,
 add column verified_at timestamptz, add column verified_duration integer;
alter table public.site_settings add column business_name text not null default '',
 add column business_address text not null default '', add column support_email text,
 add column version integer not null default 1;

create table public.coupons (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code~'^[A-Z0-9_-]{3,32}$'),
 kind text not null check(kind in('fixed','percent')), value integer not null check(value>0),
 course_id uuid references public.courses(id), expires_at timestamptz,
 total_limit integer check(total_limit>0), per_user_limit integer not null default 1 check(per_user_limit>0),
 active boolean not null default true, version integer not null default 1, created_at timestamptz not null default now(),
 check(kind<>'percent' or value<=10000)
);
create table public.coupon_redemptions (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references public.coupons(id),
 order_id uuid not null unique references public.orders(id), user_id uuid not null references public.profiles(id),
 state text not null check(state in('reserved','redeemed','released')), created_at timestamptz not null default now()
);
create table public.site_content (
 id boolean primary key default true check(id), document jsonb not null default '{}',
 version integer not null default 1, updated_at timestamptz not null default now()
);
insert into public.site_content(id)values(true);
create table public.order_watch_ranges (
 order_id uuid not null references public.orders(id),lesson_id uuid not null references public.lessons(id),
 watched int4multirange not null default '{}', primary key(order_id,lesson_id)
);
create table public.refund_requests (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id),
 user_id uuid not null references public.profiles(id), reason text not null check(length(reason) between 5 and 2000),
 state text not null default 'requested' check(state in('requested','approved','processing','rejected','failed','refunded')),
 provider_reference text not null unique default ('refund_'||replace(gen_random_uuid()::text,'-','')),
 requested_evidence jsonb not null, reviewed_evidence jsonb,
 review_note text, reviewed_by uuid references public.profiles(id),goodwill boolean not null default false,
 version integer not null default 1, created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.refund_decisions (
 id bigint generated always as identity primary key, request_id uuid not null references public.refund_requests(id),
 actor_id uuid not null references public.profiles(id), decision text not null, note text not null,
 evidence jsonb not null,goodwill boolean not null default false,created_at timestamptz not null default now()
);
create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 dedupe_key text not null unique,subject text not null,body text not null,
 state text not null default 'pending' check(state in('pending','sending','sent','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 claimed_until timestamptz,created_at timestamptz not null default now()
);
create table public.operations_tasks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 request_id uuid not null unique references public.refund_requests(id),kind text not null check(kind='telegram_remove'),
 state text not null default 'open' check(state in('open','done')),note text,
 completed_by uuid references public.profiles(id),created_at timestamptz not null default now(),completed_at timestamptz
);
create index refund_queue_idx on public.refund_requests(state,created_at);
create index notification_retry_idx on public.notification_outbox(state,next_attempt_at);
do $$declare t text;begin foreach t in array array['coupons','coupon_redemptions','site_content','order_watch_ranges','refund_requests','refund_decisions','notification_outbox','operations_tasks'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant all on public.%I to service_role',t);
end loop;end$$;
revoke update,delete on public.refund_decisions from service_role;
grant usage,select on sequence public.refund_decisions_id_seq to service_role;
grant select on public.site_content to anon,authenticated;
create policy content_public_read on public.site_content for select to anon,authenticated using(id=true);
grant select on public.refund_requests to authenticated;
create policy refunds_own_read on public.refund_requests for select to authenticated using(user_id=auth.uid() and app_private.admitted_session());

create function public.admin_guard(p_actor uuid,p_session uuid,p_admin_only boolean default true) returns text
language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
 if not public.auth_has_session(p_actor,p_session) then raise exception 'Session denied' using errcode='42501';end if;
 select role into r from public.profiles where id=p_actor;
 if r not in('admin','support') or (p_admin_only and r<>'admin') then raise exception 'Role denied' using errcode='42501';end if;
 return r;
end;$$;

-- Evidence uses the immutable purchased lesson version, never mutable current curriculum.
create function public.refund_evidence(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.orders;item jsonb;duration integer;total integer:=0;watched numeric:=0;seconds numeric;deadline timestamptz;days integer;percent integer;seen text[]:='{}';
begin
 select * into o from public.orders where id=p_order;
 if not found or o.status<>'paid' or o.paid_at is null then return jsonb_build_object('eligible',false,'valid',false,'reason','This is not a confirmed paid order.');end if;
 if coalesce(o.course_snapshot->>'watch_tracking_version','')<>'1' or jsonb_typeof(o.course_snapshot->'lessons') is distinct from 'array' then
 return jsonb_build_object('eligible',false,'valid',false,'reason','Purchase watch/policy snapshot is unavailable; support review is required.');end if;
 days:=(o.refund_policy_snapshot->>'window_days')::integer;percent:=(o.refund_policy_snapshot->>'watch_limit_percent')::integer;
 if days is null or percent is null or days<0 or days>365 or percent<0 or percent>100 then raise exception 'Bad policy';end if;
 for item in select value from jsonb_array_elements(o.course_snapshot->'lessons') loop
   if item->>'id'=any(seen) then raise exception 'Duplicate lesson';end if;seen:=array_append(seen,item->>'id');
   duration:=(item->>'duration_seconds')::integer;
   if duration is null or duration<1 or duration>86400 or item->>'is_preview' not in('true','false') then raise exception 'Bad snapshot';end if;
   if (item->>'is_preview')::boolean then continue;end if;
   total:=total+duration;
   select coalesce(sum(upper(r)-lower(r)),0)/1000.0 into seconds from public.order_watch_ranges w,
    lateral unnest(w.watched*int4multirange(int4range(0,duration*1000,'[)'))) r where w.order_id=o.id and w.lesson_id=(item->>'id')::uuid;
   watched:=watched+coalesce(seconds,0);
 end loop;
 if total<1 or total is distinct from (o.course_snapshot->>'duration_seconds')::integer then raise exception 'Bad duration';end if;
 deadline:=o.paid_at+make_interval(days=>days);
 return jsonb_build_object('valid',true,'eligible',now()<deadline and watched*100<total*percent,
 'paidAt',o.paid_at,'deadline',deadline,'watchedSeconds',watched,'durationSeconds',total,
 'watchedPercent',watched*100/total,'reason',case when now()>=deadline then 'The refund window has ended.' when watched*100>=total*percent then 'The watched-content limit has been reached.' else 'Within the purchased time and viewing limits.'end);
exception when others then
 return jsonb_build_object('eligible',false,'valid',false,'reason','Purchase watch/policy snapshot is unavailable; support review is required.');
end;$$;

create function public.refund_statuses(p_user uuid,p_session uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.auth_has_session(p_user,p_session) then raise exception 'Session denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('orderId',o.id,'evidence',public.refund_evidence(o.id),'request',case when r.id is null then null else jsonb_build_object('id',r.id,'state',r.state,'reason',r.reason,'reviewNote',r.review_note,'createdAt',r.created_at)end)),'[]') into result
 from public.orders o left join public.refund_requests r on r.order_id=o.id where o.user_id=p_user;
 return result;
end;$$;

create function public.refund_request(p_user uuid,p_session uuid,p_order uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare evidence jsonb;result uuid;
begin
 if not public.auth_has_session(p_user,p_session) then raise exception 'Session denied' using errcode='42501';end if;
 perform 1 from public.orders where id=p_order and user_id=p_user for update;
 if not found then raise exception 'Order denied' using errcode='42501';end if;
 select id into result from public.refund_requests where order_id=p_order;
 if found then return result;end if;
 evidence:=public.refund_evidence(p_order);
 if not coalesce((evidence->>'eligible')::boolean,false) then raise exception 'Refund is not eligible' using errcode='22023';end if;
 insert into public.refund_requests(order_id,user_id,reason,requested_evidence)values(p_order,p_user,p_reason,evidence)returning id into result;
 insert into public.audit_log(actor_id,action,target_type,target_id)values(p_user,'refund_requested','refund',result::text);
 return result;
end;$$;

-- All payloads are additionally validated by strict server schemas. No browser calls this RPC.
create function public.admin_mutate(p_actor uuid,p_session uuid,p_action text,p_data jsonb) returns jsonb
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
     insert into public.courses(slug,title,description,price_paise,sale_price_paise,level,language,thumbnail_url,outcomes,audience,prerequisites,artwork)
     values(p_data->>'slug',p_data->>'title',p_data->>'description',(p_data->>'price_paise')::integer,nullif(p_data->>'sale_price_paise','')::integer,p_data->>'level',p_data->>'language',nullif(p_data->>'thumbnail_url',''),p_data->'outcomes',p_data->>'audience',p_data->>'prerequisites',p_data->>'artwork')returning id into course_id;
   else
     update public.courses set title=p_data->>'title',slug=p_data->>'slug',description=p_data->>'description',price_paise=(p_data->>'price_paise')::integer,
     sale_price_paise=nullif(p_data->>'sale_price_paise','')::integer,level=p_data->>'level',language=p_data->>'language',thumbnail_url=nullif(p_data->>'thumbnail_url',''),
     outcomes=p_data->'outcomes',audience=p_data->>'audience',prerequisites=p_data->>'prerequisites',artwork=p_data->>'artwork',version=version+1,updated_at=now() where id=course_id;
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
   if not exists(select 1 from public.enrollments e where e.user_id=target and e.course_id=course_id and e.source='manual' and e.active and e.revoked_at is null)then
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

create function public.admin_students(p_actor uuid,p_session uuid,p_query text,p_page integer)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text;result jsonb;total integer;
begin
 r:=public.admin_guard(p_actor,p_session,false);
 select count(*)into total from public.profiles p join auth.users u on u.id=p.id where(r='admin'or p.role='student')and (p.full_name ilike '%'||p_query||'%'or u.email ilike '%'||p_query||'%'or p.id::text=p_query);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]')into result from(select p.id,p.full_name,u.email,p.phone,p.role,p.blocked,p.created_at from public.profiles p join auth.users u on u.id=p.id where(r='admin'or p.role='student')and(p.full_name ilike '%'||p_query||'%'or u.email ilike '%'||p_query||'%'or p.id::text=p_query)order by p.created_at desc limit 50 offset greatest(0,p_page)*50)x;
 return jsonb_build_object('items',result,'total',total);
end;$$;

-- Called only by a future server adapter AFTER verified provider confirmation, never by an admin browser.
create function public.admin_overview(p_actor uuid,p_session uuid,p_since timestamptz)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare gross bigint;refunded bigint;sales integer;students integer;pending integer;chart jsonb;breakdown jsonb;
begin
 perform public.admin_guard(p_actor,p_session,false);
 select coalesce(sum(total_paise),0),coalesce(sum(total_paise)filter(where status='refunded'),0),count(*)
 into gross,refunded,sales from public.orders where status in('paid','refunded')and paid_at>=p_since;
 select count(*)into students from public.profiles where role='student'and created_at>=p_since;
 select count(*)into pending from public.refund_requests where state='requested';
 select coalesce(jsonb_agg(jsonb_build_object('day',day,'total',total)order by day),'[]')into chart from(
 select (paid_at at time zone 'Asia/Kolkata')::date as day,sum(total_paise)as total from public.orders
 where status in('paid','refunded')and paid_at>=p_since group by 1)x;
 select coalesce(jsonb_agg(jsonb_build_object('title',title,'sales',sale_count,'gross',course_gross,'net',course_net)order by course_gross desc),'[]')into breakdown from(
 select coalesce(max(course_snapshot->>'title'),'Course')as title,count(*)as sale_count,sum(total_paise)as course_gross,
 coalesce(sum(total_paise)filter(where status='paid'),0)as course_net
 from public.orders where status in('paid','refunded')and paid_at>=p_since group by course_id)x;
 return jsonb_build_object('gross',gross,'refunded',refunded,'net',gross-refunded,'sales',sales,
 'refundRate',case when sales>0 then round(100.0*(select count(*)from public.orders where status='refunded'and paid_at>=p_since)/sales,2)else 0 end,
 'newStudents',students,'pendingRefunds',pending,'chart',chart,'courses',breakdown,'limited',false);
end;$$;

create function public.refund_settled(p_reference text,p_succeeded boolean)returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;course uuid;
begin
 select * into r from public.refund_requests where provider_reference=p_reference for update;
 if not found or r.state='refunded'then return false;end if;
 if r.state not in('approved','processing','failed')then raise exception 'Invalid refund transition'using errcode='22023';end if;
 if not p_succeeded then update public.refund_requests set state='failed',version=version+1,updated_at=now()where id=r.id;return false;end if;
 update public.orders set status='refunded'where id=r.order_id and status='paid'returning course_id into course;
 if not found then raise exception 'Order is not paid'using errcode='22023';end if;
 update public.refund_requests set state='refunded',version=version+1,updated_at=now()where id=r.id;
 update public.enrollments set active=false,revoked_at=now()where order_id=r.order_id and source='purchase';
 if not exists(select 1 from public.enrollments e join public.orders o on o.id=e.order_id where e.user_id=r.user_id and e.source='purchase'and e.active and e.revoked_at is null and o.status='paid'and o.user_id=r.user_id and o.course_id=e.course_id)then
 insert into public.operations_tasks(user_id,request_id,kind)values(r.user_id,r.id,'telegram_remove')on conflict(request_id)do nothing;end if;
 insert into public.notification_outbox(user_id,dedupe_key,subject,body)values(r.user_id,'refund:'||r.id||':refunded','Refund confirmed','The provider has confirmed your course refund. Access to that purchase has ended. Other valid course access is unaffected.')on conflict(dedupe_key)do nothing;
 insert into public.audit_log(actor_id,action,target_type,target_id)values(r.reviewed_by,'refund_confirmed','refund',r.id::text);
 return true;
end;$$;

create function public.notification_claim()returns setof public.notification_outbox
language sql security definer set search_path='' as $$
 update public.notification_outbox set state='sending',attempts=attempts+1,claimed_until=now()+interval '5 minutes'
 where id in(select id from public.notification_outbox where((state in('pending','failed')and next_attempt_at<=now())or(state='sending'and claimed_until<now()))and attempts<8 order by created_at for update skip locked limit 10)returning *;
$$;
revoke all on function public.admin_guard(uuid,uuid,boolean),public.refund_evidence(uuid),public.refund_statuses(uuid,uuid),public.refund_request(uuid,uuid,uuid,text),public.admin_mutate(uuid,uuid,text,jsonb),public.admin_students(uuid,uuid,text,integer),public.admin_overview(uuid,uuid,timestamptz),public.refund_settled(text,boolean),public.notification_claim()from public,anon,authenticated;
grant execute on function public.admin_guard(uuid,uuid,boolean),public.refund_evidence(uuid),public.refund_statuses(uuid,uuid),public.refund_request(uuid,uuid,uuid,text),public.admin_mutate(uuid,uuid,text,jsonb),public.admin_students(uuid,uuid,text,integer),public.admin_overview(uuid,uuid,timestamptz),public.refund_settled(text,boolean),public.notification_claim()to service_role;

-- Per-purchase watch ledger remains distinct from lifetime learner progress.
create or replace function public.learning_heartbeat(p_user uuid,p_session uuid,p_lease uuid,p_sequence integer,p_position integer,p_playing boolean,p_seeking boolean,p_rate numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare lease public.learning_playbacks; progress public.lesson_progress; elapsed numeric; delta integer; credit integer:=0; position integer; watched_ms bigint; instant timestamptz:=clock_timestamp();
begin
 perform 1 from public.profiles where id=p_user for update;
 select * into lease from public.learning_playbacks where user_id=p_user and id=p_lease and session_id=p_session for update;
 if not found or lease.expires_at<=instant then raise exception 'Playback expired or replaced' using errcode='22023'; end if;
 if not public.learning_can_access(p_user,p_session,lease.lesson_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_sequence<>lease.sequence+1 or p_rate<0.5 or p_rate>2 or p_position<0 then raise exception 'Invalid heartbeat' using errcode='22023'; end if;
 select * into progress from public.lesson_progress where user_id=p_user and lesson_id=lease.lesson_id for update;
 position:=least(p_position,progress.duration_seconds*1000);
 elapsed:=greatest(0,extract(epoch from instant-lease.last_at)*1000);
 delta:=position-lease.position_ms;
 -- No credit for seek jumps, missing/late pulses, or intervals that started paused.
 -- No per-request time allowance: rapid forged pulses cannot manufacture watch time.
 if lease.playing and not p_seeking and elapsed<=30000 and delta>0 and delta<=elapsed*2+1000 then
   credit:=least(delta,floor(elapsed*2)::integer);
 end if;
 update public.lesson_progress set position_ms=position,
 watched=case when credit>0 then watched+int4multirange(int4range(position-credit,position,'[)')) else watched end,
 updated_at=instant where user_id=p_user and lesson_id=lease.lesson_id returning * into progress;
 if credit>0 then
   insert into public.order_watch_ranges(order_id,lesson_id,watched)
   select o.id,lease.lesson_id,int4multirange(int4range(position-least(credit,greatest(0,floor(extract(epoch from instant-greatest(lease.last_at,o.paid_at))*2000)::integer)),position,'[)'))
   from public.enrollments e join public.orders o on o.id=e.order_id
   join public.lessons l on l.id=lease.lesson_id join public.modules m on m.id=l.module_id
   where e.user_id=p_user and e.course_id=m.course_id and e.source='purchase' and e.active and e.revoked_at is null
   and o.status='paid' and o.user_id=p_user and o.course_id=e.course_id and o.paid_at is not null and o.paid_at<=instant
   on conflict(order_id,lesson_id)do update set watched=public.order_watch_ranges.watched+excluded.watched;
 end if;
 update public.learning_playbacks set sequence=p_sequence,position_ms=position,playing=p_playing and not p_seeking,
 last_at=instant,expires_at=instant+interval '2 minutes' where user_id=p_user;
 select coalesce(sum(upper(r)-lower(r)),0) into watched_ms from unnest(progress.watched) r;
 return jsonb_build_object('sequence',p_sequence,'position',position/1000.0,'watchedSeconds',watched_ms/1000.0,'completed',progress.completed);
end;$$;

