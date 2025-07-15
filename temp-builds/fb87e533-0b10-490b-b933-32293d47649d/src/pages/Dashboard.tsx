import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { User, Calendar, ShoppingBag, Heart, Star, Edit, Trash2, Plus } from 'lucide-react';

interface Booking {
  id: string;
  service_id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  created_at: string;
  services: {
    name: string;
    duration: string;
  };
}

const Dashboard = () => {
  const { user, profile, loading } = useAuth();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    wedding_date: '',
    notes: ''
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        wedding_date: profile.wedding_date || '',
        notes: profile.notes || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      setBookingsLoading(true);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services (name, duration)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching bookings:', error);
        throw error;
      }
      
      setBookings(data || []);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profileData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    
    if (!profileData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name.trim(),
          phone: profileData.phone.trim(),
          wedding_date: profileData.wedding_date || null,
          notes: profileData.notes.trim()
        })
        .eq('id', user?.id)
        .select();
      
      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }
      
      toast.success('Profile updated successfully!');
      setEditingProfile(false);
    } catch (error: any) {
      console.error('Profile update failed:', error);
      toast.error('Failed to update profile');
    }
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    
    try {
      const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Create booking for each cart item
      const bookingPromises = cartItems.map(item => 
        supabase.from('bookings').insert({
          user_id: user?.id,
          service_id: item.product_id,
          booking_date: new Date().toISOString().split('T')[0],
          booking_time: '10:00',
          status: 'pending',
          total_amount: item.price * item.quantity
        })
      );
      
      await Promise.all(bookingPromises);
      
      // Clear cart
      clearCart();
      
      toast.success('Booking confirmed! We will contact you soon.');
      setActiveTab('bookings');
      fetchBookings();
    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error('Failed to complete booking');
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      toast.success('Booking cancelled successfully');
      fetchBookings();
    } catch (error: any) {
      console.error('Cancel booking failed:', error);
      toast.error('Failed to cancel booking');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile) {
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
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary-600 to-secondary-600 p-6">
              <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {profile.full_name}!</h1>
              <p className="text-primary-100">Manage your bridal beauty journey</p>
            </div>
            
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'profile' 
                    ? 'border-b-2 border-primary-600 text-primary-600' 
                    : 'text-gray-600 hover:text-primary-600'
                }`}
              >
                <User className="h-5 w-5" />
                Profile
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'bookings' 
                    ? 'border-b-2 border-primary-600 text-primary-600' 
                    : 'text-gray-600 hover:text-primary-600'
                }`}
              >
                <Calendar className="h-5 w-5" />
                Bookings
              </button>
              <button
                onClick={() => setActiveTab('cart')}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'cart' 
                    ? 'border-b-2 border-primary-600 text-primary-600' 
                    : 'text-gray-600 hover:text-primary-600'
                }`}
              >
                <ShoppingBag className="h-5 w-5" />
                Cart ({cartItems.length})
              </button>
            </div>
            
            <div className="p-6">
              {activeTab === 'profile' && (
                <div className="max-w-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
                    <button
                      onClick={() => setEditingProfile(!editingProfile)}
                      className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      {editingProfile ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                  
                  {editingProfile ? (
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={profileData.full_name}
                          onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileData.email}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                          disabled
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Wedding Date
                        </label>
                        <input
                          type="date"
                          value={profileData.wedding_date}
                          onChange={(e) => setProfileData({...profileData, wedding_date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={profileData.notes}
                          onChange={(e) => setProfileData({...profileData, notes: e.target.value})}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Any special requests or notes..."
                        />
                      </div>
                      
                      <button
                        type="submit"
                        className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Update Profile
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name
                          </label>
                          <p className="text-gray-900">{profile.full_name || 'Not provided'}</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <p className="text-gray-900">{profile.email}</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <p className="text-gray-900">{profile.phone || 'Not provided'}</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Wedding Date
                          </label>
                          <p className="text-gray-900">{profile.wedding_date || 'Not provided'}</p>
                        </div>
                      </div>
                      
                      {profile.notes && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <p className="text-gray-900">{profile.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'bookings' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Bookings</h2>
                  
                  {bookingsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : bookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No bookings yet. Book your first service!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bookings.map((booking) => (
                        <div key={booking.id} className="bg-gray-50 rounded-lg p-4 border">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{booking.services.name}</h3>
                              <p className="text-gray-600">Duration: {booking.services.duration}</p>
                              <p className="text-gray-600">Date: {booking.booking_date} at {booking.booking_time}</p>
                              <p className="text-gray-600">Amount: ${booking.total_amount}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {booking.status}
                              </span>
                              {booking.status === 'pending' && (
                                <button
                                  onClick={() => cancelBooking(booking.id)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'cart' && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h2>
                  
                  {cartItems.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Your cart is empty. Add some services!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cartItems.map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-lg p-4 border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <img 
                                src={item.image_url} 
                                alt={item.name}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                              <div>
                                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                <p className="text-primary-600 font-medium">${item.price}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                              >
                                -
                              </button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                              >
                                +
                              </button>
                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="ml-4 text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-lg font-semibold">Total: ${cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                          <button
                            onClick={handleCheckout}
                            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            Book Services
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;