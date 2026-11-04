-- Migration 202611040021: Handle expired Cashfree orders by ignoring pending orders older than 1 hour
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
 -- Automatically cancel pending orders older than Cashfree's 1-hour order lifetime
 update public.orders set status='cancelled' where user_id=p_user and course_id=c.id and status='pending'
 and provider_order_id like 'cf_sbx_%' and created_at <= now() - interval '1 hour';
 -- Return active pending order only if within the 1-hour window
 select * into o from public.orders where user_id=p_user and course_id=c.id and status='pending'
 and provider_order_id like 'cf_sbx_%' and created_at > now() - interval '1 hour' order by created_at desc limit 1;
 if found then return o.id;end if;
 select * into s from public.site_settings where id=true for share;
 if not found then raise exception 'Settings unavailable';end if;
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

revoke all on function public.commerce_create_order(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.commerce_create_order(uuid,uuid,text,text) to service_role;
