-- Private, non-payable reservations survive QR validation and network failures.
create table public.upi_gateway_setups (
 order_id uuid primary key references public.orders(id) on delete cascade,
 token text unique check(token is null or token ~ '^[A-Za-z0-9_-]{24,128}$'),
 started_at timestamptz not null default clock_timestamp()
);
alter table public.upi_gateway_setups enable row level security;
revoke all on public.upi_gateway_setups from public,anon,authenticated,service_role;

create function public.purchase_upi_gateway_prepare(p_user uuid,p_order uuid,p_claim uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders;s public.upi_gateway_setups;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.status<>'pending' or o.purchase_provider<>'upi' or o.provider_order_id is not null or p_claim is null
 then raise exception 'Invalid payment setup' using errcode='22023';end if;
 if o.creation_claim is not null and o.creation_claim_until>clock_timestamp() then
  return jsonb_build_object('state','busy','retryAfter',greatest(1,ceil(extract(epoch from o.creation_claim_until-clock_timestamp()))::integer));
 end if;
 select * into s from public.upi_gateway_setups where order_id=p_order;
 -- No reference was received: allow the remote 60-minute reservation plus a safety margin to expire.
 if found and s.token is null then
  if s.started_at+interval '65 minutes'>clock_timestamp() then
   return jsonb_build_object('state','unknown','retryAfter',greatest(1,ceil(extract(epoch from s.started_at+interval '65 minutes'-clock_timestamp()))::integer));
  end if;
  delete from public.upi_gateway_setups where order_id=p_order;
  s:=null;
 end if;
 update public.orders set creation_claim=p_claim,creation_claim_until=clock_timestamp()+interval '2 minutes' where id=p_order;
 if s.order_id is null then
  insert into public.upi_gateway_setups(order_id)values(p_order)returning * into s;
  return jsonb_build_object('state','create','createdAt',s.started_at);
 end if;
 return jsonb_build_object('state','resume','token',s.token,'createdAt',s.started_at);
end;$$;

create function public.purchase_upi_gateway_save(p_user uuid,p_order uuid,p_claim uuid,p_token text)returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.status<>'pending' or o.provider_order_id is not null or o.creation_claim is distinct from p_claim
  or o.creation_claim_until<=clock_timestamp() or p_token is null or p_token !~ '^[A-Za-z0-9_-]{24,128}$'
 then raise exception 'Payment setup conflict' using errcode='22023';end if;
 update public.upi_gateway_setups set token=p_token where order_id=p_order and (token is null or token=p_token);
 if not found then raise exception 'Payment setup conflict' using errcode='22023';end if;
end;$$;

create function public.purchase_upi_gateway_release(p_user uuid,p_order uuid,p_claim uuid,p_safe_retry boolean default false)returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.orders where id=p_order and user_id=p_user and creation_claim=p_claim and provider_order_id is null for update;
 if not found then return;end if;
 if p_safe_retry then delete from public.upi_gateway_setups where order_id=p_order and token is null;end if;
 update public.orders set creation_claim=null,creation_claim_until=null where id=p_order;
end;$$;

create function public.purchase_upi_gateway_abandon(p_user uuid,p_order uuid,p_claim uuid,p_token text)returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Called only after owner-authenticated upstream EXPIRED/REJECTED, never on a timeout.
 update public.orders set status='cancelled',creation_claim=null,creation_claim_until=null
 where id=p_order and user_id=p_user and status='pending' and provider_order_id is null and creation_claim=p_claim
 and exists(select 1 from public.upi_gateway_setups where order_id=p_order and token=p_token);
 if not found then raise exception 'Payment setup conflict' using errcode='22023';end if;
end;$$;

alter function public.purchase_upi_gateway_bind(uuid,uuid,uuid,text,integer,text,text,timestamptz)rename to purchase_upi_gateway_bind_before_recovery;
create function public.purchase_upi_gateway_bind(p_user uuid,p_order uuid,p_claim uuid,p_token text,p_amount integer,p_vpa text,p_payee text,p_expires timestamptz)returns void
language plpgsql security definer set search_path='' as $$
declare s public.upi_gateway_setups;
begin
 perform 1 from public.orders where id=p_order and user_id=p_user for update;
 select * into s from public.upi_gateway_setups where order_id=p_order;
 if found and (s.token is distinct from p_token or p_expires>s.started_at+interval '50 minutes')
 then raise exception 'Payment setup conflict' using errcode='22023';end if;
 perform public.purchase_upi_gateway_bind_before_recovery(p_user,p_order,p_claim,p_token,p_amount,p_vpa,p_payee,p_expires);
 delete from public.upi_gateway_setups where order_id=p_order;
end;$$;

create function public.purchase_freeze_gateway_quote()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.provider_order_id is null and exists(select 1 from public.upi_gateway_setups where order_id=old.id)
 and (new.total_paise is distinct from old.total_paise or new.base_paise is distinct from old.base_paise
  or new.tax_paise is distinct from old.tax_paise or new.discount_paise is distinct from old.discount_paise
  or new.course_snapshot->>'coupon_code' is distinct from old.course_snapshot->>'coupon_code')
 then raise exception 'Resume the saved payment before changing its quote' using errcode='22023';end if;
 return new;
end;$$;
create trigger purchase_freeze_gateway_quote before update on public.orders for each row execute function public.purchase_freeze_gateway_quote();

alter function public.purchase_read(text,uuid,text)rename to purchase_read_before_gateway_recovery;
create function public.purchase_read(p_action text,p_user uuid,p_ref text default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.purchase_read_before_gateway_recovery(p_action,p_user,p_ref);
 if p_action='order' and result is not null then
  result:=result||jsonb_build_object('couponCode',(select course_snapshot->>'coupon_code' from public.orders where id=(result->>'id')::uuid and user_id=p_user));
 end if;
 return result;
end;$$;

revoke all on function public.purchase_upi_gateway_prepare(uuid,uuid,uuid),public.purchase_upi_gateway_save(uuid,uuid,uuid,text),
 public.purchase_upi_gateway_release(uuid,uuid,uuid,boolean),public.purchase_upi_gateway_abandon(uuid,uuid,uuid,text),
 public.purchase_upi_gateway_bind(uuid,uuid,uuid,text,integer,text,text,timestamptz),public.purchase_freeze_gateway_quote(),
 public.purchase_read(text,uuid,text)from public,anon,authenticated;
grant execute on function public.purchase_upi_gateway_prepare(uuid,uuid,uuid),public.purchase_upi_gateway_save(uuid,uuid,uuid,text),
 public.purchase_upi_gateway_release(uuid,uuid,uuid,boolean),public.purchase_upi_gateway_abandon(uuid,uuid,uuid,text),
 public.purchase_upi_gateway_bind(uuid,uuid,uuid,text,integer,text,text,timestamptz),public.purchase_read(text,uuid,text)to service_role;
