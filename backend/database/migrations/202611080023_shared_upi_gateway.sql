-- Academy consumes IndianXtrade's existing deposit API, sharing its amount allocator.
-- No IndianXtrade gateway tables/functions are changed by this migration.
alter table public.upi_intents add column gateway_checkout_token text unique;

create function public.purchase_upi_gateway_info(p_user uuid,p_order uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('token',i.gateway_checkout_token,'amount',i.amount_paise)
 from public.upi_intents i join public.orders o on o.id=i.order_id
 where i.order_id=p_order and o.user_id=p_user and i.gateway_checkout_token is not null;
$$;
create function public.purchase_upi_gateway_bind(p_user uuid,p_order uuid,p_claim uuid,p_token text,p_amount integer,p_vpa text,p_payee text,p_expires timestamptz)returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;adjustment integer;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.status<>'pending' or o.purchase_provider<>'upi' or o.creation_claim is distinct from p_claim
   or o.provider_order_id is not null or p_token is null or p_token !~ '^[A-Za-z0-9_-]{24,128}$'
   or p_amount is null or p_amount>o.total_paise or p_amount<o.total_paise-1999
   or p_expires is null or p_amount<49001 or p_vpa is null or p_payee is null or p_expires<=clock_timestamp()
   or p_expires>clock_timestamp()+interval '60 minutes'
 then raise exception 'Shared payment setup conflict' using errcode='22023';end if;
 adjustment:=o.total_paise-p_amount;
 insert into public.upi_intents(order_id,amount_paise,vpa,payee_name,expires_at,gateway_checkout_token)
 values(p_order,p_amount,p_vpa,p_payee,p_expires,p_token);
 update public.orders set total_paise=p_amount,discount_paise=discount_paise+adjustment,
 course_snapshot=course_snapshot||jsonb_build_object('upi_adjustment_paise',adjustment,'upi_gateway','indianxtrade'),
 provider_order_id='upi_'||p_order,creation_claim=null,creation_claim_until=null where id=p_order;
end;$$;
create function public.purchase_upi_gateway_close(p_user uuid,p_order uuid)returns void
language sql security definer set search_path='' as $$
 update public.orders set status='cancelled' where id=p_order and user_id=p_user and status='pending'
 and exists(select 1 from public.upi_intents i where i.order_id=p_order and i.gateway_checkout_token is not null);
$$;
create or replace function public.purchase_read(p_action text,p_user uuid,p_ref text default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;intent public.upi_intents;
begin
 result:=public.purchase_read_before_upi(p_action,p_user,p_ref);
 if p_action='order' and result->>'provider'='upi' then
  select * into intent from public.upi_intents where order_id=(result->>'id')::uuid;
  if found then result:=result||jsonb_build_object('upi',jsonb_build_object('vpa',intent.vpa,'payeeName',intent.payee_name,'amount',intent.amount_paise,'expiresAt',intent.expires_at,'gateway',case when intent.gateway_checkout_token is not null then 'indianxtrade' else 'bank-relay' end));end if;
 end if;
 return result;
end;$$;
revoke all on function public.purchase_upi_gateway_info(uuid,uuid),public.purchase_upi_gateway_bind(uuid,uuid,uuid,text,integer,text,text,timestamptz),public.purchase_upi_gateway_close(uuid,uuid)from public,anon,authenticated;
grant execute on function public.purchase_upi_gateway_info(uuid,uuid),public.purchase_upi_gateway_bind(uuid,uuid,uuid,text,integer,text,text,timestamptz),public.purchase_upi_gateway_close(uuid,uuid)to service_role;

-- Shared-gateway intents must never be settled by the legacy Academy SMS consumer.
create or replace function public.purchase_upi_credit(p_utr text,p_amount integer,p_received timestamptz,p_sender text,p_body text)returns uuid
language plpgsql security definer set search_path='' as $$
declare credit public.upi_credits; intent public.upi_intents; oid uuid;
begin
 if p_utr is null or length(p_utr) not between 6 and 32 or p_amount is null or p_amount<1
   or p_received is null or p_received>clock_timestamp()+interval '2 minutes'
   or p_received<clock_timestamp()-interval '7 days' then raise exception 'Invalid bank credit' using errcode='22023'; end if;
 lock table public.upi_intents in share row exclusive mode;
 insert into public.upi_credits(utr,amount_paise,received_at,sender,body)values(p_utr,p_amount,p_received,p_sender,p_body)on conflict(utr)do nothing;
 select * into credit from public.upi_credits where utr=p_utr for update;
 if credit.amount_paise<>p_amount then raise exception 'Reference reused with different amount' using errcode='22023'; end if;
 if credit.order_id is not null then return credit.order_id; end if;
 -- An expired checkout stays unmatched for manual reconciliation, even after a delayed alert.
 select i.* into intent from public.upi_intents i join public.orders o on o.id=i.order_id
 where i.gateway_checkout_token is null and i.amount_paise=p_amount and i.created_at<=credit.received_at and i.expires_at>clock_timestamp()
   and credit.received_at<=i.expires_at and o.status='pending' and o.purchase_provider='upi';
 if not found then return null; end if;
 oid:=intent.order_id;
 perform public.purchase_settle(jsonb_build_object('provider','upi','providerOrderId','upi_'||oid,
   'providerPaymentId','upi_'||p_utr,'amount',p_amount,'currency','INR','status','paid'));
 update public.upi_credits set order_id=oid where utr=p_utr;
 return oid;
end;$$;
