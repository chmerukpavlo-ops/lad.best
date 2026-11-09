-- Optional brand + list price (ориєнтир) on listings.
-- list_price is UAH numeric, not sale price.

alter table public.listings
  add column if not exists brand text
    constraint listings_brand_len_chk check (
      brand is null or char_length(brand) <= 120
    );

alter table public.listings
  add column if not exists list_price numeric(12, 2)
    constraint listings_list_price_nonneg_chk check (
      list_price is null or list_price >= 0
    )
    constraint listings_list_price_scale_chk check (
      list_price is null or scale(list_price) <= 2
    );
