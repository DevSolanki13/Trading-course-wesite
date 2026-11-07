-- Preserve the gateway's original UPI parameters (including merchant code and note).
alter table public.upi_intents add column gateway_upi_uri text check(gateway_upi_uri is null or (gateway_upi_uri like 'upi://pay?%' and length(gateway_upi_uri)<=4096));
create function public.purchase_upi_gateway_bind(p_user uuid,p_order uuid,p_claim uuid,p_token text,p_amount integer,p_vpa text,p_payee text,p_expires timestamptz,p_uri text)returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_uri is null or p_uri not like 'upi://pay?%' or length(p_uri)>4096 then raise exception 'Invalid gateway UPI URI' using errcode='22023';end if;
 perform public.purchase_upi_gateway_bind(p_user,p_order,p_claim,p_token,p_amount,p_vpa,p_payee,p_expires);
 update public.upi_intents set gateway_upi_uri=p_uri where order_id=p_order;
end;$$;
create or replace function public.purchase_read(p_action text,p_user uuid,p_ref text default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;intent public.upi_intents;
begin
 result:=public.purchase_read_before_upi(p_action,p_user,p_ref);
 if p_action='order' and result->>'provider'='upi' then
  select * into intent from public.upi_intents where order_id=(result->>'id')::uuid;
  if found then result:=result||jsonb_build_object('upi',jsonb_build_object('vpa',intent.vpa,'payeeName',intent.payee_name,'amount',intent.amount_paise,'expiresAt',intent.expires_at,'uri',intent.gateway_upi_uri,'gateway',case when intent.gateway_checkout_token is not null then 'indianxtrade' else 'bank-relay' end));end if;
 end if;
 return result;
end;$$;
revoke all on function public.purchase_upi_gateway_bind(uuid,uuid,uuid,text,integer,text,text,timestamptz,text)from public,anon,authenticated;
grant execute on function public.purchase_upi_gateway_bind(uuid,uuid,uuid,text,integer,text,text,timestamptz,text)to service_role;
