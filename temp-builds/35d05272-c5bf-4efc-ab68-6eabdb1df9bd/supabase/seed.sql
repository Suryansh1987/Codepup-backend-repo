-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create admin user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@nonnaspizzeria.com',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Create admin profile
INSERT INTO public.profiles (id, email, full_name, role) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin@nonnaspizzeria.com', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Insert sample products
INSERT INTO public.products (id, name, description, price, image_url, category, is_featured, ingredients) VALUES 
  ('00000000-0000-0000-0001-000000000001', 'Margherita Pizza', 'Classic Italian pizza with fresh mozzarella, tomatoes, and basil', 18.99, 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=500&h=400&fit=crop', 'Classic', true, ARRAY['fresh mozzarella', 'tomatoes', 'basil', 'olive oil']),
  ('00000000-0000-0000-0001-000000000002', 'Pepperoni Pizza', 'Traditional pepperoni pizza with mozzarella cheese and spicy pepperoni', 22.99, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&h=400&fit=crop', 'Classic', true, ARRAY['mozzarella', 'pepperoni', 'tomato sauce']),
  ('00000000-0000-0000-0001-000000000003', 'Quattro Stagioni', 'Four seasons pizza with mushrooms, ham, artichokes, and olives', 26.99, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=400&fit=crop', 'Gourmet', true, ARRAY['mushrooms', 'ham', 'artichokes', 'olives', 'mozzarella']),
  ('00000000-0000-0000-0001-000000000004', 'Prosciutto e Funghi', 'Delicious pizza with prosciutto, mushrooms, and fresh mozzarella', 24.99, 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=500&h=400&fit=crop', 'Gourmet', true, ARRAY['prosciutto', 'mushrooms', 'mozzarella', 'olive oil']),
  ('00000000-0000-0000-0001-000000000005', 'Vegetarian Supreme', 'Loaded with bell peppers, onions, mushrooms, tomatoes, and olives', 21.99, 'https://images.unsplash.com/photo-1593560708920-61dd4043d072?w=500&h=400&fit=crop', 'Vegetarian', true, ARRAY['bell peppers', 'onions', 'mushrooms', 'tomatoes', 'olives']),
  ('00000000-0000-0000-0001-000000000006', 'Meat Lovers', 'Hearty pizza with pepperoni, sausage, ham, and bacon', 28.99, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&h=400&fit=crop', 'Meat', true, ARRAY['pepperoni', 'sausage', 'ham', 'bacon', 'mozzarella']),
  ('00000000-0000-0000-0001-000000000007', 'Hawaiian Pizza', 'Controversial but delicious with ham and pineapple', 20.99, 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&h=400&fit=crop', 'Classic', false, ARRAY['ham', 'pineapple', 'mozzarella']),
  ('00000000-0000-0000-0001-000000000008', 'BBQ Chicken', 'Smoky BBQ sauce with grilled chicken, red onions, and cilantro', 25.99, 'https://images.unsplash.com/photo-1606750473704-b2c7cffb0e7c?w=500&h=400&fit=crop', 'Specialty', false, ARRAY['BBQ chicken', 'red onions', 'cilantro', 'BBQ sauce']),
  ('00000000-0000-0000-0001-000000000009', 'White Pizza', 'Creamy white sauce with ricotta, mozzarella, and garlic', 23.99, 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=500&h=400&fit=crop', 'Specialty', false, ARRAY['ricotta', 'mozzarella', 'garlic', 'white sauce']),
  ('00000000-0000-0000-0001-000000000010', 'Seafood Special', 'Fresh seafood pizza with shrimp, mussels, and calamari', 32.99, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&h=400&fit=crop', 'Seafood', false, ARRAY['shrimp', 'mussels', 'calamari', 'garlic', 'olive oil'])
ON CONFLICT (id) DO NOTHING;

-- Insert sample testimonials
INSERT INTO public.testimonials (id, name, email, comment, rating) VALUES 
  ('00000000-0000-0000-0002-000000000001', 'Maria Rodriguez', 'maria@example.com', 'Best pizza in town! The Margherita is absolutely perfect, just like my nonna used to make.', 5),
  ('00000000-0000-0000-0002-000000000002', 'John Smith', 'john@example.com', 'Amazing authentic Italian flavors. The crust is perfectly crispy and the ingredients are so fresh!', 5),
  ('00000000-0000-0000-0002-000000000003', 'Sofia Chen', 'sofia@example.com', 'I''ve been coming here for years and it never disappoints. The service is great and the pizza is incredible.', 5),
  ('00000000-0000-0000-0002-000000000004', 'Michael Johnson', 'michael@example.com', 'The Quattro Stagioni is my favorite! You can taste the quality in every bite. Highly recommended!', 5),
  ('00000000-0000-0000-0002-000000000005', 'Emma Wilson', 'emma@example.com', 'Family-owned restaurant with heart and soul. The wood-fired oven makes all the difference!', 5),
  ('00000000-0000-0000-0002-000000000006', 'Carlos Martinez', 'carlos@example.com', 'Excellent pizza and friendly staff. The ingredients are always fresh and the atmosphere is cozy.', 4)
ON CONFLICT (id) DO NOTHING;

-- Create some sample users
INSERT INTO public.profiles (id, email, full_name, role) VALUES 
  ('00000000-0000-0000-0003-000000000001', 'user1@example.com', 'Regular Customer', 'user'),
  ('00000000-0000-0000-0003-000000000002', 'user2@example.com', 'Pizza Lover', 'user'),
  ('00000000-0000-0000-0003-000000000003', 'user3@example.com', 'Frequent Visitor', 'user')
ON CONFLICT (id) DO NOTHING;

-- Insert sample orders
INSERT INTO public.orders (id, user_id, total_amount, status) VALUES 
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0003-000000000001', 41.98, 'delivered'),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0003-000000000002', 26.99, 'preparing'),
  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0003-000000000003', 52.98, 'ready')
ON CONFLICT (id) DO NOTHING;

-- Insert sample order items
INSERT INTO public.order_items (order_id, product_id, quantity, price) VALUES 
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0001-000000000001', 1, 18.99),
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0001-000000000002', 1, 22.99),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0001-000000000003', 1, 26.99),
  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0001-000000000004', 1, 24.99),
  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0001-000000000006', 1, 28.99)
ON CONFLICT (id) DO NOTHING;