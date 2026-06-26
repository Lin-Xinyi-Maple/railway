import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { environment } from '../../environments/environment';
import { Account, Address, ApiResponse, CartItem, Category, Comment, Complaint, DashboardSummary, FavoriteItem, FriendRelation, FriendsView, Message, Order, Page, Product, Shop, SystemLog, UserStats } from '../models/domain';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    let httpParams = new HttpParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') httpParams = httpParams.set(key, String(value));
    });
    return this.http.get<ApiResponse<T>>(`${this.base}${path}`, { params: httpParams }).pipe(map(res => res.data));
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<ApiResponse<T>>(`${this.base}${path}`, body).pipe(map(res => res.data));
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<ApiResponse<T>>(`${this.base}${path}`, body).pipe(map(res => res.data));
  }

  delete<T>(path: string) {
    return this.http.delete<ApiResponse<T>>(`${this.base}${path}`).pipe(map(res => res.data));
  }

  deleteWithBody<T>(path: string, body: unknown) {
    return this.http.delete<ApiResponse<T>>(`${this.base}${path}`, { body }).pipe(map(res => res.data));
  }

  upload(path: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<ApiResponse<{ url: string; object_key: string }>>(`${this.base}${path}`, body).pipe(map(res => res.data));
  }

  categories() {
    return this.get<Category[]>('/categories');
  }

  products(params: Record<string, string | number | undefined>) {
    return this.get<Page<Product>>('/products', params);
  }

  product(id: number) {
    return this.get<Product>(`/products/${id}`);
  }

  createProduct(product: Partial<Product>) {
    return this.post<Product>('/products', product);
  }

  updateProduct(productId: number, product: Partial<Product>) {
    return this.put<Product>(`/products/${productId}`, product);
  }

  deleteProduct(productId: number) {
    return this.delete<boolean>(`/products/${productId}`);
  }

  uploadProductImage(file: File) {
    return this.upload('/uploads/product-image', file);
  }

  shop(id: number) {
    return this.get<Shop>(`/shops/${id}`);
  }

  merchantShop() {
    return this.get<Shop>('/merchant/shop');
  }

  createMerchantShop(shop: Pick<Shop, 'name' | 'description' | 'shipping_address' | 'phone'>) {
    return this.post<Shop>('/shops', shop);
  }

  updateMerchantShop(shop: Partial<Shop>) {
    return this.put<Shop>('/merchant/shop', shop);
  }

  addToCart(productId: number, quantity = 1) {
    return this.post('/cart', { product_id: productId, quantity });
  }

  cart() {
    return this.get<CartItem[]>('/cart');
  }

  deleteCartItem(itemId: number) {
    return this.delete<boolean>(`/cart/${itemId}`);
  }

  addresses() {
    return this.get<Address[]>('/addresses');
  }

  createAddress(address: Partial<Address>) {
    return this.post<Address>('/addresses', address);
  }

  updateAddress(addressId: number, address: Partial<Address>) {
    return this.put<Address>(`/addresses/${addressId}`, address);
  }

  deleteAddress(addressId: number) {
    return this.delete<boolean>(`/addresses/${addressId}`);
  }

  orders() {
    return this.get<Page<Order>>('/orders');
  }

  createOrder(productId: number, addressId?: number, quantity = 1) {
    return this.post<Order>('/orders', { product_id: productId, address_id: addressId, quantity });
  }

  order(id: number) {
    return this.get<Order>(`/orders/${id}`);
  }

  orderShippingGeo(id: number) {
    return this.get<Pick<Order, 'shipping_geo' | 'shipping_notice' | 'baidu_map_ak'>>(`/orders/${id}/shipping-geo`);
  }

  payOrder(id: number, addressId: number, paymentMethod: string) {
    return this.post<Order>(`/orders/${id}/pay`, { address_id: addressId, payment_method: paymentMethod });
  }

  receiveOrder(id: number) {
    return this.post<Order>(`/orders/${id}/receive`, {});
  }

  applyAfterSale(id: number) {
    return this.post<Order>(`/orders/${id}/after-sale`, {});
  }

  completeAfterSale(id: number) {
    return this.post<Order>(`/orders/${id}/after-sale/complete`, {});
  }

  deleteOrder(id: number) {
    return this.delete<boolean>(`/orders/${id}`);
  }

  aiChat(productId: number, question: string) {
    return this.post<{ answer: string }>(`/ai/chat/${productId}`, { question });
  }

  aiReview(productId: number) {
    return this.post<{ product_id?: number; score: number; conclusion: string; created_at?: string }>(`/ai/review/${productId}`, {});
  }

  productComments(productId: number) {
    return this.get<{ product: Product; comments: Comment[]; can_comment: boolean; can_reply: boolean }>(`/products/${productId}/comments`);
  }

  createComment(payload: { product_id: number; rating: number; content: string; image_url?: string }) {
    return this.post<Comment>('/comments', payload);
  }

  replyComment(commentId: number, reply: string) {
    return this.post<Comment>(`/comments/${commentId}/reply`, { reply });
  }

  deleteComment(commentId: number) {
    return this.delete<boolean>(`/comments/${commentId}`);
  }

  deleteCommentReply(commentId: number) {
    return this.delete<boolean>(`/comments/${commentId}/reply`);
  }

  uploadCommentImage(file: File) {
    return this.upload('/uploads/comment-image', file);
  }

  uploadComplaintImage(file: File) {
    return this.upload('/uploads/complaint-image', file);
  }

  complaints(params?: Record<string, string | number | boolean | undefined>) {
    return this.get<Complaint[]>('/complaints', params);
  }

  complaint(id: number) {
    return this.get<Complaint>(`/complaints/${id}`);
  }

  createComplaint(payload: Partial<Complaint>) {
    return this.post<Complaint>('/complaints', payload);
  }

  updateComplaint(complaintId: number, payload: Partial<Complaint>) {
    return this.put<Complaint>(`/complaints/${complaintId}`, payload);
  }

  deleteComplaint(complaintId: number) {
    return this.delete<boolean>(`/complaints/${complaintId}`);
  }

  processComplaint(complaintId: number) {
    return this.put<Complaint>(`/complaints/${complaintId}/processed`, {});
  }

  uploadMessageImage(file: File) {
    return this.upload('/uploads/message-image', file);
  }

  favoriteProduct(productId: number) {
    return this.post<boolean>(`/favorites/${productId}`, {});
  }

  unfavoriteProduct(productId: number) {
    return this.delete<boolean>(`/favorites/${productId}`);
  }

  favorites() {
    return this.get<FavoriteItem[]>('/favorites');
  }

  deleteFavoriteItem(favoriteId: number) {
    return this.delete<boolean>(`/favorites/items/${favoriteId}`);
  }

  merchantSummary(range?: string) {
    return this.get<DashboardSummary>('/merchant/summary', { range });
  }

  merchantAfterSales(keyword?: string) {
    return this.get<Page<Order>>('/merchant/after-sales', { keyword, page: 1, page_size: 80 });
  }

  restockProduct(productId: number, quantity: number) {
    return this.post<Product>(`/merchant/products/${productId}/restock`, { quantity });
  }

  adminSummary(range?: string) {
    return this.get<DashboardSummary>('/admin/summary', { range });
  }

  updateAccountStatus(accountId: number, status: 'active' | 'disabled') {
    return this.put<Account>(`/admin/accounts/${accountId}/status`, { status });
  }

  updateShopStatus(shopId: number, status: 'active' | 'disabled') {
    return this.put<Shop>(`/admin/shops/${shopId}/status`, { status });
  }

  updateProductStatus(productId: number, status: 'on_sale' | 'off_sale' | 'disabled') {
    return this.put<Product>(`/admin/products/${productId}/status`, { status });
  }

  messages() {
    return this.get<Message[]>('/messages');
  }

  messageUnreadCount() {
    return this.get<{ count: number }>('/messages/unread-count');
  }

  markMessagesRead(payload: { thread_key?: string; sender_id?: number }) {
    return this.post<{ count: number }>('/messages/read', payload);
  }

  sendSystemMessage(payload: { content: string; image_url?: string }) {
    return this.post<Message>('/messages/system', payload);
  }

  sendMessage(payload: { receiver_id: number; content: string; image_url?: string }) {
    return this.post<Message>('/messages/send', payload);
  }

  adminSendMessage(payload: { target_mode: 'all_users' | 'all_merchants' | 'selected'; receiver_emails?: string[]; content: string; image_url?: string }) {
    return this.post<{ sent: number }>('/admin/messages/send', payload);
  }

  searchAccountByEmail(email: string) {
    return this.get<Account>('/accounts/search', { email });
  }

  friends() {
    return this.get<FriendsView>('/friends');
  }

  inviteFriend(email: string) {
    return this.post<FriendRelation>('/friends/invite', { email });
  }

  acceptFriendRequest(friendId: number) {
    return this.post<FriendRelation>(`/friends/requests/${friendId}/accept`, {});
  }

  deleteFriend(friendId: number) {
    return this.delete<boolean>(`/friends/${friendId}`);
  }

  reviewableOrders() {
    return this.get<Order[]>('/user/reviewable-orders');
  }

  userStats() {
    return this.get<UserStats>('/user/stats');
  }

  updateProfile(payload: { nickname: string; avatar?: string }) {
    return this.put<Account>('/account/profile', payload);
  }

  updateEmail(payload: { old_email_code: string; new_email: string; new_email_code: string }) {
    return this.post<Account>('/account/email', payload);
  }

  updatePassword(payload: { current_password: string; new_password: string }) {
    return this.post<boolean>('/account/password', payload);
  }

  deleteOwnAccount(emailCode: string) {
    return this.deleteWithBody<boolean>('/account/me', { email_code: emailCode });
  }

  uploadAvatar(file: File) {
    return this.upload('/uploads/avatar', file);
  }

  deleteShop(shopId: number) {
    return this.delete<boolean>(`/shops/${shopId}`);
  }

  deleteMerchantShop() {
    return this.delete<boolean>('/merchant/shop');
  }

  systemLogs(params: Record<string, string | number | undefined>) {
    return this.get<Page<SystemLog>>('/admin/system-logs', params);
  }

  deleteSystemLog(logId: number) {
    return this.delete<boolean>(`/admin/system-logs/${logId}`);
  }

  clearSystemLogs() {
    return this.delete<{ deleted: number }>('/admin/system-logs');
  }
}
