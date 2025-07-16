import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Package, Users, DollarSign, ShoppingCart, Edit, Trash2, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  is_featured: boolean;
  ingredients: string[];
  created_at: string;
}

interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  order_items: {
    id: string;
    quantity: number;
    price: number;
    products: {
      name: string;
      price: number;
      image_url: string;
    } | null;
  }[];
}

interface Stats {
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  totalRevenue: number;
}

const AdminDashboard = () => {
  const { profile, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ totalOrders: 0, totalProducts: 0, totalUsers: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    image_url: '',
    category: '',
    is_featured: false,
    ingredients: ''
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAdminData();
    }
  }, [profile]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      // Fetch each table separately to avoid RLS conflicts
      const [productsRes, ordersRes, profilesRes, orderItemsRes] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('order_items').select('*')
      ]);
      
      // Check for errors
      if (productsRes.error) {
        console.error('Products error:', productsRes.error);
        throw productsRes.error;
      }
      if (ordersRes.error) {
        console.error('Orders error:', ordersRes.error);
        throw ordersRes.error;
      }
      if (profilesRes.error) {
        console.error('Profiles error:', profilesRes.error);
        throw profilesRes.error;
      }
      if (orderItemsRes.error) {
        console.error('Order items error:', orderItemsRes.error);
        throw orderItemsRes.error;
      }
      
      // Log data counts for debugging
      console.log('Products loaded:', productsRes.data?.length || 0);
      console.log('Orders loaded:', ordersRes.data?.length || 0);
      console.log('Profiles loaded:', profilesRes.data?.length || 0);
      console.log('Order items loaded:', orderItemsRes.data?.length || 0);
      
      // Manually join data in JavaScript
      const ordersWithDetails = ordersRes.data?.map(order => {
        const userProfile = profilesRes.data?.find(p => p.id === order.user_id);
        const orderItems = orderItemsRes.data?.filter(item => item.order_id === order.id);
        
        const itemsWithProducts = orderItems?.map(item => {
          const product = productsRes.data?.find(p => p.id === item.product_id);
          return {
            ...item,
            products: product ? { 
              name: product.name, 
              price: product.price,
              image_url: product.image_url 
            } : null
          };
        });
        
        return {
          ...order,
          profiles: userProfile ? { 
            full_name: userProfile.full_name, 
            email: userProfile.email 
          } : null,
          order_items: itemsWithProducts || []
        };
      });
      
      // Set state with joined data
      setProducts(productsRes.data || []);
      setOrders(ordersWithDetails || []);
      setStats({
        totalOrders: ordersRes.data?.length || 0,
        totalProducts: productsRes.data?.length || 0,
        totalUsers: profilesRes.data?.filter(p => p.role === 'user').length || 0,
        totalRevenue: ordersWithDetails?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0
      });
      
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productForm.name?.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    if (!productForm.description?.trim()) {
      toast.error('Product description is required');
      return;
    }
    
    if (productForm.price <= 0) {
      toast.error('Product price must be greater than 0');
      return;
    }
    
    if (!productForm.category?.trim()) {
      toast.error('Product category is required');
      return;
    }
    
    try {
      const productData = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        price: productForm.price,
        image_url: productForm.image_url.trim() || '/placeholder-pizza.jpg',
        category: productForm.category.trim(),
        is_featured: productForm.is_featured,
        ingredients: productForm.ingredients ? productForm.ingredients.split(',').map(i => i.trim()) : []
      };
      
      console.log('Submitting product:', productData);
      
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        
        if (error) {
          console.error('Product update error:', error);
          throw error;
        }
        
        toast.success('Product updated successfully!');
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);
        
        if (error) {
          console.error('Product creation error:', error);
          throw error;
        }
        
        toast.success('Product created successfully!');
      }
      
      setShowProductDialog(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        price: 0,
        image_url: '',
        category: '',
        is_featured: false,
        ingredients: ''
      });
      
      await fetchAdminData();
    } catch (error: any) {
      console.error('Product operation failed:', error);
      toast.error(error.message || 'Failed to save product');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      image_url: product.image_url,
      category: product.category,
      is_featured: product.is_featured,
      ingredients: product.ingredients?.join(', ') || ''
    });
    setShowProductDialog(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Product deletion error:', error);
        throw error;
      }
      
      toast.success('Product deleted successfully!');
      await fetchAdminData();
    } catch (error: any) {
      console.error('Product deletion failed:', error);
      toast.error(error.message || 'Failed to delete product');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      
      if (error) {
        console.error('Order status update error:', error);
        throw error;
      }
      
      toast.success('Order status updated successfully!');
      await fetchAdminData();
    } catch (error: any) {
      console.error('Order status update failed:', error);
      toast.error(error.message || 'Failed to update order status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'preparing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Manage your pizzeria</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-primary-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Products</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
                  </div>
                  <Package className="h-8 w-8 text-primary-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                  </div>
                  <Users className="h-8 w-8 text-primary-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="space-y-6">
            <TabsList>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Products</CardTitle>
                    <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          onClick={() => {
                            setEditingProduct(null);
                            setProductForm({
                              name: '',
                              description: '',
                              price: 0,
                              image_url: '',
                              category: '',
                              is_featured: false,
                              ingredients: ''
                            });
                          }}
                          className="bg-primary-600 hover:bg-primary-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Product
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>
                            {editingProduct ? 'Edit Product' : 'Add New Product'}
                          </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleProductSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="name">Name</Label>
                              <Input
                                id="name"
                                value={productForm.name}
                                onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="category">Category</Label>
                              <Input
                                id="category"
                                value={productForm.category}
                                onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                                required
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={productForm.description}
                              onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                              required
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="price">Price</Label>
                              <Input
                                id="price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={productForm.price}
                                onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value) || 0})}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="image_url">Image URL</Label>
                              <Input
                                id="image_url"
                                value={productForm.image_url}
                                onChange={(e) => setProductForm({...productForm, image_url: e.target.value})}
                                placeholder="https://example.com/image.jpg"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="ingredients">Ingredients (comma-separated)</Label>
                            <Input
                              id="ingredients"
                              value={productForm.ingredients}
                              onChange={(e) => setProductForm({...productForm, ingredients: e.target.value})}
                              placeholder="cheese, tomato sauce, pepperoni"
                            />
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="is_featured"
                              checked={productForm.is_featured}
                              onChange={(e) => setProductForm({...productForm, is_featured: e.target.checked})}
                            />
                            <Label htmlFor="is_featured">Featured Product</Label>
                          </div>
                          
                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setShowProductDialog(false)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit" className="bg-primary-600 hover:bg-primary-700">
                              {editingProduct ? 'Update' : 'Create'}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {products.map((product) => (
                      <div key={product.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">{product.name}</h3>
                            <Badge variant="outline">{product.category}</Badge>
                            {product.is_featured && <Badge className="bg-accent-500">Featured</Badge>}
                          </div>
                          <p className="text-gray-600 text-sm">{product.description}</p>
                          <p className="text-primary-600 font-bold">${product.price}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle>Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold">Order #{order.id.slice(-8)}</h3>
                            <p className="text-sm text-gray-600">
                              Customer: {order.profiles?.full_name || 'Unknown Customer'}
                            </p>
                            <p className="text-sm text-gray-600">
                              Email: {order.profiles?.email || 'Unknown Email'}
                            </p>
                            <p className="text-sm text-gray-600">
                              Date: {formatDate(order.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleUpdateOrderStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="preparing">Preparing</SelectItem>
                                <SelectItem value="ready">Ready</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-lg font-bold mt-2">${order.total_amount.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Order Items:</h4>
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                              <span>{item.products?.name || 'Unknown Product'} x{item.quantity}</span>
                              <span>${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;