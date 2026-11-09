-- Additive Phase 4 read APIs. Apply before the matching application release.
-- Old catalog/order/payment/refund mutation contracts remain unchanged.
create function public.purchase_course_v2(p_user uuid,p_ref text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'slug',c.slug,'title',c.title,'description',c.description,
 'price',coalesce(c.sale_price_paise,c.price_paise),'currency','INR','level',c.level,'language',c.language,'thumbnail',c.thumbnail_url,
 'accessPeriod',c.access_period,'accessUnit',c.access_unit,
 'accessExpiresAt',(select max(e.expires_at) from public.enrollments e left join public.orders o on o.id=e.order_id
   where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null
   and(e.source='manual' or(o.status='paid' and o.user_id=p_user and o.course_id=c.id))),
 'owned',public.purchase_has_access(p_user,c.id),
 'progress',coalesce((select round(100.0*count(*)filter(where lp.completed)/nullif(count(*),0))
   from public.modules m join public.lessons l on l.module_id=m.id and l.published
   left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user where m.course_id=c.id),0),
 'modules',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'lessons',
   coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'duration',l.duration_seconds,
   'preview',l.is_preview,'completed',coalesce(lp.completed,false)) order by l.position)
   from public.lessons l left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user
   where l.module_id=m.id and l.published),'[]'::jsonb)) order by m.position)
   from public.modules m where m.course_id=c.id),'[]'::jsonb))
 from public.courses c where c.status='published' and(c.slug=p_ref or c.id::text=p_ref)
 -- Legacy catalog order resolves the rare UUID-shaped slug/ID collision consistently.
 order by c.created_at limit 1;
$$;

-- Preserve the latest UPI decoration exactly; intercept only the course read.
create or replace function public.purchase_read(p_action text,p_user uuid,p_ref text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;intent public.upi_intents;
begin
 if p_action='course' then return public.purchase_course_v2(p_user,p_ref);end if;
 result:=public.purchase_read_before_upi(p_action,p_user,p_ref);
 if p_action='order' and result->>'provider'='upi' then
  select * into intent from public.upi_intents where order_id=(result->>'id')::uuid;
  if found then result:=result||jsonb_build_object('upi',jsonb_build_object('vpa',intent.vpa,'payeeName',intent.payee_name,'amount',intent.amount_paise,'expiresAt',intent.expires_at,'uri',intent.gateway_upi_uri,'gateway',case when intent.gateway_checkout_token is not null then 'indianxtrade' else 'bank-relay' end));end if;
 end if;
 return result;
end;$$;

create function public.admin_refund_page_v2(p_actor uuid,p_session uuid,p_state text default null,p_page integer default 0) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 perform public.admin_guard(p_actor,p_session,false);
 if p_page is null or p_page<0 or p_page>1000000 or
   (p_state is not null and p_state not in('requested','approved','processing','failed','rejected','refunded')) then
   raise exception 'Invalid refund page' using errcode='22023';
 end if;
 with page as materialized (
   select r.* from public.refund_requests r where p_state is null or r.state=p_state
   order by r.created_at desc,r.id limit 50 offset p_page::bigint*50
 ) select jsonb_build_object(
   'items',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('current_evidence',public.refund_evidence(p.order_id))
     order by p.created_at desc,p.id) from page p),'[]'::jsonb),
   'total',(select count(*) from public.refund_requests r where p_state is null or r.state=p_state)
 ) into result;
 return result;
end;$$;

revoke all on function public.purchase_course_v2(uuid,text),public.admin_refund_page_v2(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.purchase_course_v2(uuid,text),public.admin_refund_page_v2(uuid,uuid,text,integer) to service_role;
notify pgrst,'reload schema';
