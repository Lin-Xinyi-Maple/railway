export type Role = 'user' | 'merchant' | 'admin';
export type OrderStatus = '待付款' | '待收货' | '已收货' | '售后中' | '完成售后';

export interface ApiResponse<T> {
  data: T;
  message: string;
  error: string | null;
}

export interface Account {
  id: number;
  username: string;
  nickname: string;
  email: string;
  avatar?: string;
  role: Role;
  status: 'active' | 'disabled';
  created_at?: string;
  last_login_at?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Shop {
  id: number;
  owner_account_id: number;
  name: string;
  description: string;
  type: 'merchant' | 'self';
  status: 'active' | 'disabled';
  shipping_address: string;
  phone: string;
  created_at?: string;
  products_count?: number;
  paid_orders_count?: number;
  paid_amount?: number;
  products?: Product[];
  owner?: Account;
}

export interface Product {
  id: number;
  shop_id: number;
  category_id: number;
  name: string;
  main_image: string;
  image_2?: string;
  image_3?: string;
  detail: string;
  price: number;
  unit: string;
  stock: number;
  warning_stock: number;
  origin: string;
  planting_method: string;
  shelf_life_days: number;
  storage_condition: string;
  status: string;
  category_name: string;
  shop_name: string;
  shop_type: 'merchant' | 'self';
  merchant_account_id?: number;
  is_favorite?: boolean;
  order_users_count?: number;
  paid_users_count?: number;
  comment_count?: number;
  created_at?: string;
  images?: { id: number; image_url: string }[];
  comments?: Comment[];
}

export interface Address {
  id: number;
  receiver_name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  is_default: boolean;
  created_at?: string;
}

export interface Order {
  id: number;
  order_no: string;
  total_amount: number;
  quantity: number;
  unit_price: number;
  status: OrderStatus;
  product: Product;
  shop: Shop;
  user?: Account;
  address?: Address;
  receiver_full_address?: string;
  created_at: string;
  paid_at?: string;
  payment_method?: string;
  is_visible?: boolean;
  shipping_geo?: {
    address?: string;
    full_address?: string;
    province?: string;
    city?: string;
    district?: string;
    lng?: number | null;
    lat?: number | null;
    fallback_lng?: number | null;
    fallback_lat?: number | null;
    fallback_zoom?: number | null;
    source?: string;
  };
  shipping_notice?: string;
  baidu_map_ak?: string;
}

export interface CartItem {
  id: number;
  quantity: number;
  unit_price?: number;
  line_total?: number;
  product: Product;
}

export interface Comment {
  id: number;
  product_id: number;
  user_id: number;
  rating: number;
  content: string;
  image_url?: string;
  merchant_reply?: string;
  merchant_replied_at?: string;
  created_at: string;
  user?: Account;
}

export interface Complaint {
  id: number;
  complainant_id: number;
  title: string;
  content: string;
  image1?: string;
  image2?: string;
  image3?: string;
  phone: string;
  is_processed: boolean;
  created_at: string;
  complainant?: Account;
}

export interface Message {
  id: number;
  sender_id?: number | null;
  receiver_id: number;
  title: string;
  content: string;
  type: 'system' | 'system_chat' | 'chat';
  is_read: boolean;
  link_url?: string;
  image_url?: string;
  created_at: string;
  sender?: Account | null;
  receiver?: Account | null;
}

export interface FavoriteItem {
  id: number;
  user_id: number;
  product_id: number;
  created_at: string;
  product: Product;
}

export interface FriendRelation {
  id: number;
  applicant_id: number;
  receiver_id: number;
  is_accepted: boolean;
  created_at?: string;
  accepted_at?: string;
  applicant?: Account;
  receiver?: Account;
  other?: Account;
  direction?: 'sent' | 'received';
}

export interface FriendsView {
  friends: FriendRelation[];
  requests: FriendRelation[];
}

export interface DashboardSummary {
  users?: number;
  shops: number | Shop[];
  products?: number;
  products_count?: number;
  orders?: number;
  orders_count?: number;
  sales: number;
  low_stock?: number;
  buyers?: Account[];
  merchant_shops?: Shop[];
  product_list?: Product[];
  order_list?: Order[];
  low_stock_products?: Product[];
  income_details?: Order[];
  chart?: { date: string; sales: number; orders: number }[];
  sales_chart?: { date: string; sales: number; orders: number }[];
  growth_chart?: { date: string; users: number; shops: number }[];
}

export interface UserStats {
  created_orders: number;
  paid_orders: number;
  paid_amount: number;
  category_paid: { name: string; amount: number }[];
  daily?: { date: string; created: number; paid: number; amount: number }[];
}

export interface SystemLog {
  id: number;
  actor_id?: number | null;
  actor_username?: string | null;
  actor_role?: string | null;
  action: string;
  target_type: string;
  target_id?: number | null;
  detail?: string | null;
  ip_address?: string | null;
  created_at?: string;
  actor?: Account | null;
}
