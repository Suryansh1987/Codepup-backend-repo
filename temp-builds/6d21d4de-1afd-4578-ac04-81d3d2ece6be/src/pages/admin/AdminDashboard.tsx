import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Users, ShoppingBag, Calendar, DollarSign, Edit, Trash2, Plus, Star, Image } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  image_url: string;
  is_featured: boolean;
  category: string;
}

interface Booking {
  id: string;
  user_id: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  created_at: string;
}

interface Testimonial {
  id: string;
  name: string;
  review: string;
  rating: number;
  image_url: string;
  created_at: string;
}

interface Portfolio {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string;
  wedding_date: string;
  notes: string;
}

interface Stats {
  totalUsers: number;
  totalBookings: number;
  totalServices: number;
  totalRevenue: number;
}

const AdminDashboard = () => {
  const { profile, loading } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBookings: 0,
    totalServices: 0,
    totalRevenue: 0
  });
  const [adminLoading, setAdminLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentTable, setCurrentTable] = useState('');

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAdminData();
    } else if (profile && profile.role !== 'admin') {
      // Redirect non-admin users handled by parent component
    }
  }, [profile]);

  const fetchAdminData = async () => {
    try {
      setAdminLoading(true);
      
      // Fetch each table separately to avoid RLS conflicts
      const [servicesRes, bookingsRes, testimonialsRes, portfolioRes, profilesRes] = await Promise.all([
        supabase.from('services').select('*').order('created_at', { ascending: false }),
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('testimonials').select('*').order('created_at', { ascending: false }),
        supabase.from('portfolio').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*')
      ]);
      
      // Check for errors
      if (servicesRes.error) {
        console.error('Services error:', servicesRes.error);
        throw servicesRes.error;
      }
      if (bookingsRes.error) {
        console.error('Bookings error:', bookingsRes.error);
        throw bookingsRes.error;
      }
      if (testimonialsRes.error) {
        console.error('Testimonials error:', testimonialsRes.error);
        throw testimonialsRes.error;
      }
      if (portfolioRes.error) {
        console.error('Portfolio error:', portfolioRes.error);
        throw portfolioRes.error;
      }
      if (profilesRes.error) {
        console.error('Profiles error:', profilesRes.error);
        throw profilesRes.error;
      }
      
      // Log data counts for debugging
      console.log('Services loaded:', servicesRes.data?.length || 0);
      console.log('Bookings loaded:', bookingsRes.data?.length || 0);
      console.log('Testimonials loaded:', testimonialsRes.data?.length || 0);
      console.log('Portfolio loaded:', portfolioRes.data?.length || 0);
      console.log('Profiles loaded:', profilesRes.data?.length || 0);
      
      // Set state with data
      setServices(servicesRes.data || []);
      setBookings(bookingsRes.data || []);
      setTestimonials(testimonialsRes.data || []);
      setPortfolio(portfolioRes.data || []);
      setProfiles(profilesRes.data || []);
      
      // Calculate stats
      const totalRevenue = bookingsRes.data?.reduce((sum, booking) => sum + (booking.total_amount || 0), 0) || 0;
      
      setStats({
        totalUsers: profilesRes.data?.filter(p => p.role === 'user').length || 0,
        totalBookings: bookingsRes.data?.length || 0,
        totalServices: servicesRes.data?.length || 0,
        totalRevenue
      });
      
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleEdit = (item: any, table: string) => {
    setEditingItem(item);
    setCurrentTable(table);
  };

  const handleSave = async (formData: any) => {
    try {
      const { data, error } = await supabase
        .from(currentTable)
        .update(formData)
        .eq('id', editingItem.id)
        .select();
      
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      
      toast.success('Item updated successfully!');
      setEditingItem(null);
      setCurrentTable('');
      fetchAdminData();
    } catch (error: any) {
      console.error('Save failed:', error);
      toast.error('Failed to update item');
    }
  };

  const handleDelete = async (id: string, table: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Delete error:', error);
        throw error;
      }
      
      toast.success('Item deleted successfully!');
      fetchAdminData();
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleAdd = async (formData: any) => {
    try {
      const { data, error } = await supabase
        .from(currentTable)
        .insert(formData)
        .select();
      
      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      
      toast.success('Item added successfully!');
      setShowAddModal(false);
      setCurrentTable('');
      fetchAdminData();
    } catch (error: any) {
      console.error('Add failed:', error);
      toast.error('Failed to add item');
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      toast.success('Booking status updated!');
      fetchAdminData();
    } catch (error: any) {
      console.error('Status update failed:', error);
      toast.error('Failed to update booking status');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-accent-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary-600 to-secondary-600 p-6">
              <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
              <p className="text-primary-100">Manage your bridal makeup business</p>
            </div>
            
            <div className="flex border-b overflow-x-auto">
              {['overview', 'services', 'bookings', 'testimonials', 'portfolio', 'users'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab 
                      ? 'border-b-2 border-primary-600 text-primary-600' 
                      : 'text-gray-600 hover:text-primary-600'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            
            <div className="p-6">
              {adminLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <div>
                  {activeTab === 'overview' && (
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Overview</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-primary-100">Total Users</p>
                              <p className="text-3xl font-bold">{stats.totalUsers}</p>
                            </div>
                            <Users className="h-8 w-8 text-primary-200" />
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-lg p-6 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-secondary-100">Total Bookings</p>
                              <p className="text-3xl font-bold">{stats.totalBookings}</p>
                            </div>
                            <Calendar className="h-8 w-8 text-secondary-200" />
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-accent-500 to-accent-600 rounded-lg p-6 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-accent-100">Total Services</p>
                              <p className="text-3xl font-bold">{stats.totalServices}</p>
                            </div>
                            <ShoppingBag className="h-8 w-8 text-accent-200" />
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-green-100">Total Revenue</p>
                              <p className="text-3xl font-bold">${stats.totalRevenue}</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-green-200" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'services' && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Services</h2>
                        <button
                          onClick={() => {
                            setShowAddModal(true);
                            setCurrentTable('services');
                          }}
                          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Service
                        </button>
                      </div>
                      
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service) => (
                          <div key={service.id} className="bg-gray-50 rounded-lg p-4 border">
                            <img 
                              src={service.image_url} 
                              alt={service.name}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                            />
                            <h3 className="font-semibold text-gray-900 mb-2">{service.name}</h3>
                            <p className="text-gray-600 text-sm mb-2">{service.description}</p>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-primary-600 font-medium">${service.price}</span>
                              <span className="text-sm text-gray-500">{service.duration}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(service, 'services')}
                                className="text-blue-600 hover:text-blue-800 p-1"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(service.id, 'services')}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'bookings' && (
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Bookings</h2>
                      
                      <div className="space-y-4">
                        {bookings.map((booking) => {
                          const userProfile = profiles.find(p => p.id === booking.user_id);
                          const service = services.find(s => s.id === booking.service_id);
                          
                          return (
                            <div key={booking.id} className="bg-gray-50 rounded-lg p-4 border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className="font-semibold text-gray-900">
                                    {service?.name || 'Unknown Service'}
                                  </h3>
                                  <p className="text-gray-600">
                                    Customer: {userProfile?.full_name || 'Unknown Customer'}
                                  </p>
                                  <p className="text-gray-600">
                                    Email: {userProfile?.email || 'Unknown Email'}
                                  </p>
                                  <p className="text-gray-600">
                                    Date: {booking.booking_date} at {booking.booking_time}
                                  </p>
                                  <p className="text-gray-600">Amount: ${booking.total_amount}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={booking.status}
                                    onChange={(e) => updateBookingStatus(booking.id, e.target.value)}
                                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                  <button
                                    onClick={() => handleDelete(booking.id, 'bookings')}
                                    className="text-red-600 hover:text-red-800 p-1"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'testimonials' && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Testimonials</h2>
                        <button
                          onClick={() => {
                            setShowAddModal(true);
                            setCurrentTable('testimonials');
                          }}
                          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Testimonial
                        </button>
                      </div>
                      
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {testimonials.map((testimonial) => (
                          <div key={testimonial.id} className="bg-gray-50 rounded-lg p-4 border">
                            <div className="flex items-center mb-3">
                              <img 
                                src={testimonial.image_url} 
                                alt={testimonial.name}
                                className="w-10 h-10 rounded-full object-cover mr-3"
                              />
                              <div>
                                <h3 className="font-semibold text-gray-900">{testimonial.name}</h3>
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star 
                                      key={i} 
                                      className={`h-4 w-4 ${i < testimonial.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-gray-600 text-sm mb-3">{testimonial.review}</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(testimonial, 'testimonials')}
                                className="text-blue-600 hover:text-blue-800 p-1"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(testimonial.id, 'testimonials')}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'portfolio' && (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Portfolio</h2>
                        <button
                          onClick={() => {
                            setShowAddModal(true);
                            setCurrentTable('portfolio');
                          }}
                          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Portfolio Item
                        </button>
                      </div>
                      
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {portfolio.map((item) => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-4 border">
                            <img 
                              src={item.image_url} 
                              alt={item.title}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                            />
                            <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                            <p className="text-gray-600 text-sm mb-2">{item.description}</p>
                            <p className="text-gray-500 text-sm mb-3">{item.category}</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEdit(item, 'portfolio')}
                                className="text-blue-600 hover:text-blue-800 p-1"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, 'portfolio')}
                                className="text-red-600 hover:text-red-800 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'users' && (
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">Users</h2>
                      
                      <div className="space-y-4">
                        {profiles.filter(p => p.role === 'user').map((profile) => (
                          <div key={profile.id} className="bg-gray-50 rounded-lg p-4 border">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-gray-900">{profile.full_name}</h3>
                                <p className="text-gray-600">{profile.email}</p>
                                {profile.phone && <p className="text-gray-600">Phone: {profile.phone}</p>}
                                {profile.wedding_date && <p className="text-gray-600">Wedding Date: {profile.wedding_date}</p>}
                                {profile.notes && <p className="text-gray-600">Notes: {profile.notes}</p>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                  {profile.role}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit {currentTable}</h3>
            <EditForm 
              item={editingItem} 
              table={currentTable} 
              onSave={handleSave} 
              onCancel={() => setEditingItem(null)}
            />
          </div>
        </div>
      )}
      
      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add {currentTable}</h3>
            <AddForm 
              table={currentTable} 
              onAdd={handleAdd} 
              onCancel={() => setShowAddModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Edit Form Component
const EditForm = ({ item, table, onSave, onCancel }: any) => {
  const [formData, setFormData] = useState(item);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseFloat(value) : value
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {table === 'services' && (
        <>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Service Name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Description"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            required
          />
          <input
            name="price"
            type="number"
            value={formData.price}
            onChange={handleChange}
            placeholder="Price"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="duration"
            value={formData.duration}
            onChange={handleChange}
            placeholder="Duration"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            placeholder="Image URL"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="category"
            value={formData.category}
            onChange={handleChange}
            placeholder="Category"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </>
      )}
      
      {table === 'testimonials' && (
        <>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <textarea
            name="review"
            value={formData.review}
            onChange={handleChange}
            placeholder="Review"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            required
          />
          <input
            name="rating"
            type="number"
            min="1"
            max="5"
            value={formData.rating}
            onChange={handleChange}
            placeholder="Rating (1-5)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            placeholder="Image URL"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </>
      )}
      
      {table === 'portfolio' && (
        <>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Title"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Description"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            required
          />
          <input
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            placeholder="Image URL"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="category"
            value={formData.category}
            onChange={handleChange}
            placeholder="Category"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </>
      )}
      
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// Add Form Component
const AddForm = ({ table, onAdd, onCancel }: any) => {
  const [formData, setFormData] = useState<any>({});
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'number' ? parseFloat(value) : value
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {table === 'services' && (
        <>
          <input
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            placeholder="Service Name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <textarea
            name="description"
            value={formData.description || ''}
            onChange={handleChange}
            placeholder="Description"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            required
          />
          <input
            name="price"
            type="number"
            value={formData.price || ''}
            onChange={handleChange}
            placeholder="Price"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="duration"
            value={formData.duration || ''}
            onChange={handleChange}
            placeholder="Duration"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="image_url"
            value={formData.image_url || ''}
            onChange={handleChange}
            placeholder="Image URL"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="category"
            value={formData.category || ''}
            onChange={handleChange}
            placeholder="Category"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </>
      )}
      
      {table === 'testimonials' && (
        <>
          <input
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            placeholder="Name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <textarea
            name="review"
            value={formData.review || ''}
            onChange={handleChange}
            placeholder="Review"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            required
          />
          <input
            name="rating"
            type="number"
            min="1"
            max="5"
            value={formData.rating || ''}
            onChange={handleChange}
            placeholder="Rating (1-5)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="image_url"
            value={formData.image_url || ''}
            onChange={handleChange}
            placeholder="Image URL"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </>
      )}
      
      {table === 'portfolio' && (
        <>
          <input
            name="title"
            value={formData.title || ''}
            onChange={handleChange}
            placeholder="Title"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <textarea
            name="description"
            value={formData.description || ''}
            onChange={handleChange}
            placeholder="Description"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            required
          />
          <input
            name="image_url"
            value={formData.image_url || ''}
            onChange={handleChange}
            placeholder="Image URL"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
          <input
            name="category"
            value={formData.category || ''}
            onChange={handleChange}
            placeholder="Category"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
          />
        </>
      )}
      
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default AdminDashboard;