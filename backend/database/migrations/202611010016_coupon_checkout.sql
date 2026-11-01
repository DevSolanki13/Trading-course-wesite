-- Server-owned coupon validation, reservation and immutable discounted order totals.
create or replace function public.coupon_discount(
  p_user uuid,
  p_course uuid,
  p_base integer,
  p_code text
) returns integer
language plpgsql
stable
security definer
set search_path=''
as $$
declare c public.coupons; discount integer; used_total integer; used_user integer;
begin
  if nullif(trim(p_code),'') is null then return 0; end if;
  select * into c from public.coupons where code=upper(trim(p_code)) and active;
  if not found or (c.expires_at is not null and c.expires_at<=now())
    or (c.course_id is not null and c.course_id<>p_course)
    then raise exception 'Coupon is invalid or unavailable' using errcode='22023'; end if;
  select count(*) into used_total from public.coupon_redemptions
    where coupon_id=c.id and state in('reserved','redeemed');
  select count(*) into used_user from public.coupon_redemptions
    where coupon_id=c.id and user_id=p_user and state in('reserved','redeemed');
  if c.total_limit is not null and used_total>=c.total_limit
    or used_user>=c.per_user_limit
    then raise exception 'Coupon usage limit reached' using errcode='22023'; end if;
  discount:=case when c.kind='percent' then floor(p_base*c.value/10000.0)::integer else c.value end;
  return least(greatest(discount,0),p_base);
end;
$$;

create or replace function public.purchase_quote_coupon(
  p_user uuid,
  p_course text,
  p_code text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare c public.courses; base integer; discount integer;
begin
  select * into c from public.courses where (slug=p_course or id::text=p_course) and status='published';
  if not found then raise exception 'Course unavailable' using errcode='22023'; end if;
  base:=coalesce(c.sale_price_paise,c.price_paise);
  discount:=public.coupon_discount(p_user,c.id,base,p_code);
  return jsonb_build_object('base',base,'discount',discount,'total',base-discount);
end;
$$;

create or replace function public.purchase_create_order(
  p_user uuid,
  p_course text,
  p_provider text,
  p_origin text,
  p_coupon text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare order_id uuid; c public.courses; discount integer; coupon_id uuid;
begin
  order_id:=public.purchase_create_order(p_user,p_course,p_provider,p_origin);
  if nullif(trim(p_coupon),'') is null then return order_id; end if;
  select * into c from public.courses where (slug=p_course or id::text=p_course);
  discount:=public.coupon_discount(p_user,c.id,(select base_paise from public.orders where id=order_id),p_coupon);
  select id into coupon_id from public.coupons where code=upper(trim(p_coupon));
  update public.orders set discount_paise=discount,total_paise=base_paise-discount+tax_paise,
    course_snapshot=course_snapshot||jsonb_build_object('coupon_code',upper(trim(p_coupon)),'discount_paise',discount)
    where id=order_id and status='pending';
  insert into public.coupon_redemptions(coupon_id,order_id,user_id,state)
    values(coupon_id,order_id,p_user,'reserved');
  return order_id;
end;
$$;

create or replace function public.coupon_order_changed() returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='paid' then
    update public.coupon_redemptions set state='redeemed' where order_id=new.id and state='reserved';
  elsif new.status in('failed','cancelled','refunded') then
    update public.coupon_redemptions set state='released' where order_id=new.id and state='reserved';
  end if;
  return new;
end;
$$;
create trigger coupon_order_changed after update of status on public.orders
for each row execute function public.coupon_order_changed();
revoke all on function public.coupon_discount(uuid,uuid,integer,text),
  public.purchase_quote_coupon(uuid,text,text),
  public.purchase_create_order(uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.coupon_discount(uuid,uuid,integer,text),
  public.purchase_quote_coupon(uuid,text,text),
  public.purchase_create_order(uuid,text,text,text,text)
  to service_role;
