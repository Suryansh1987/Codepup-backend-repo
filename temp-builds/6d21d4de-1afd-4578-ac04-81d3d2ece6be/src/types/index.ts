export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  phone?: string;
  wedding_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  image_url: string;
  is_featured: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  review: string;
  rating: number;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}