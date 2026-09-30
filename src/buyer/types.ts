export interface BuyerSearchArgs {
  query: string;
  category?: string;
  category_url?: string;
  min_price?: number;
  max_price?: number;
  min_seller_rating?: number;
  min_product_rating?: number;
  available_only?: boolean;
  prom_payment?: boolean;
  seller?: string;
  sort?: "relevance" | "price_asc" | "price_desc" | "seller_rating" | "product_rating";
  max_pages?: number;
  limit?: number;
}

export interface BuyerProduct {
  title: string;
  url: string;
  price_uah?: number;
  available?: boolean;
  prom_payment?: boolean;
  seller?: string;
  seller_rating?: number;
  product_rating?: number;
  raw_text?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  search: BuyerSearchArgs;
  created_at: string;
  updated_at: string;
}
