-- Provider failure communication and a last-moment guard for manual group removal.
-- The business promise is at most two active devices; Admin may lower the cap to one.
alter table public.site_settings add constraint site_settings_device_limit_max_two check(device_limit between 1 and 2);

create or replace function public.refund_request(p_user uuid,p_session uuid,p_order uuid,p_reason text) returns uuid
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
 insert into public.notification_outbox(user_id,dedupe_key,subject,body)
 values(p_user,'refund:'||result||':requested','Refund request received','Your refund request is recorded for review. This is not approval or payment-provider confirmation.')on conflict(dedupe_key)do nothing;
 return result;
end;$$;
create or replace function public.refund_settled(p_reference text,p_succeeded boolean)returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;course uuid;
begin
 select * into r from public.refund_requests where provider_reference=p_reference for update;
 if not found or r.state='refunded' then return false;end if;
 if r.state not in('approved','processing','failed')then raise exception 'Invalid refund transition'using errcode='22023';end if;
 if not p_succeeded then
   if r.state='failed' then return false;end if;
   update public.refund_requests set state='failed',version=version+1,updated_at=now()where id=r.id;
   insert into public.notification_outbox(user_id,dedupe_key,subject,body)
   values(r.user_id,'refund:'||r.id||':failed','Refund processing update','Your refund has not been confirmed by the payment provider. Your course access remains active while our team reviews the issue.')on conflict(dedupe_key)do nothing;
   insert into public.audit_log(actor_id,action,target_type,target_id)values(r.reviewed_by,'refund_provider_failed','refund',r.id::text);
   return false;
 end if;
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

create function public.guard_group_removal()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.state='open'and new.state='done'and exists(
   select 1 from public.enrollments e join public.orders o on o.id=e.order_id
   where e.user_id=new.user_id and e.source='purchase'and e.active and e.revoked_at is null
   and o.status='paid' and o.user_id=new.user_id and o.course_id=e.course_id
 )then raise exception 'Buyer has qualifying paid access; do not remove group membership'using errcode='22023';end if;
 return new;
end;$$;
revoke all on function public.guard_group_removal()from public,anon,authenticated;
create trigger group_removal_recheck before update of state on public.operations_tasks
for each row execute procedure public.guard_group_removal();
