-- Demo checkout is isolated to local/staging by the application gate. All writes are atomic.
create function public.demo_create_order(p_user uuid, p_session uuid, p_slug text)
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
    where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null
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

create function public.demo_settle_payment(p_hash text,p_event jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; event_id uuid; next_status text := p_event->>'status';
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or next_status is null
    or next_status not in ('pending','paid','failed','cancelled')
    or coalesce(p_event->>'providerOrderId','') !~ '^demo_[0-9a-f-]{36}$' then
    raise exception 'Invalid event' using errcode='22023';
  end if;
  select * into o from public.orders where provider_order_id=p_event->>'providerOrderId' for update;
  if not found or (p_event->>'amountPaise') is null
    or o.total_paise<>(p_event->>'amountPaise')::integer then
    raise exception 'Order mismatch' using errcode='22023';
  end if;
  insert into public.webhook_events(provider,payload_hash,payload)
    values('demo',p_hash,p_event) on conflict(provider,payload_hash) do nothing returning id into event_id;
  if event_id is null then return; end if;
  -- Terminal orders never move backwards or grant access after failure/refund.
  if o.status='pending' then
    update public.orders set status=next_status,
      paid_at=case when next_status='paid' then now() else null end where id=o.id;
    update public.payment_attempts set status=next_status where order_id=o.id;
    if next_status='paid' then
      insert into public.enrollments(user_id,course_id,order_id,source,active)
        values(o.user_id,o.course_id,o.id,'purchase',true) on conflict(order_id) do nothing;
    end if;
  end if;
  update public.webhook_events set status='processed',processed_at=now() where id=event_id;
end;
$$;
revoke all on function public.demo_create_order(uuid,uuid,text),public.demo_settle_payment(text,jsonb) from public,anon,authenticated;
grant execute on function public.demo_create_order(uuid,uuid,text),public.demo_settle_payment(text,jsonb) to service_role;
