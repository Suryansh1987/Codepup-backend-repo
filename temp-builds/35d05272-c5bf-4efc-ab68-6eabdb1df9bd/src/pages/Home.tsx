import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Pizza, Star, Clock, Users, ShoppingCart, Phone, MapPin, Mail } from 'lucide-react';
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
}

interface Testimonial {
  id: string;
  name: string;
  comment: string;
  rating: number;
  created_at: string;
}

const Home = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [productsRes, testimonialsRes] = await Promise.all([
          supabase.from('products').select('*').eq('is_featured', true),
          supabase.from('testimonials').select('*').order('created_at', { ascending: false }).limit(6)
        ]);
        
        if (productsRes.error) {
          console.error('Products error:', productsRes.error);
          throw productsRes.error;
        }
        if (testimonialsRes.error) {
          console.error('Testimonials error:', testimonialsRes.error);
          throw testimonialsRes.error;
        }
        
        console.log('Products loaded:', productsRes.data?.length || 0);
        console.log('Testimonials loaded:', testimonialsRes.data?.length || 0);
        
        setProducts(productsRes.data || []);
        setTestimonials(testimonialsRes.data || []);
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddToCart = async (product: Product) => {
    try {
      await addToCart(product);
      toast.success(`${product.name} added to cart!`);
    } catch (error) {
      console.error('Add to cart error:', error);
      toast.error('Failed to add item to cart');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Page</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-900 via-primary-700 to-secondary-600 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <Pizza className="h-16 w-16 text-accent-400" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Nonna's Pizzeria
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-gray-100">
              Authentic Italian pizzas made with love, traditional recipes, and the finest ingredients
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-accent-500 hover:bg-accent-600 text-white"
                onClick={() => scrollToSection('menu')}
              >
                View Our Menu
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-primary-900"
                onClick={() => scrollToSection('contact')}
              >
                Order Now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">About Nonna's Pizzeria</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Since 1952, we've been serving authentic Italian pizzas using traditional recipes passed down through generations. 
                Every pizza is hand-tossed and baked in our wood-fired oven for that perfect crust.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Pizza className="h-8 w-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Authentic Recipes</h3>
                <p className="text-gray-600">Traditional Italian recipes from our founder's grandmother</p>
              </div>
              <div className="text-center">
                <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Fast Service</h3>
                <p className="text-gray-600">Fresh pizzas ready in 15-20 minutes</p>
              </div>
              <div className="text-center">
                <div className="bg-primary-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Family Owned</h3>
                <p className="text-gray-600">Three generations of pizza-making expertise</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Menu Section */}
      <section id="menu" className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Featured Pizzas</h2>
            <p className="text-lg text-gray-600">Try our most popular handcrafted pizzas</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {products.slice(0, 6).map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                  <Badge className="absolute top-2 left-2 bg-primary-600">
                    {product.category}
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>{product.name}</span>
                    <span className="text-primary-600">${product.price}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{product.description}</p>
                  {product.ingredients && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Ingredients:</p>
                      <div className="flex flex-wrap gap-1">
                        {product.ingredients.map((ingredient, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {ingredient}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button 
                    onClick={() => handleAddToCart(product)}
                    className="w-full bg-primary-600 hover:bg-primary-700"
                    disabled={!user}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {user ? 'Add to Cart' : 'Login to Order'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-lg text-gray-600">Don't just take our word for it</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{testimonial.name}</CardTitle>
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < testimonial.rating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 italic">"{testimonial.comment}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-primary-900 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Visit Us Today</h2>
              <p className="text-lg text-gray-200">Come taste the difference tradition makes</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Ready to Order Section (Moved up) */}
              <div>
                <h3 className="text-2xl font-semibold mb-6">Ready to Order?</h3>
                <p className="text-gray-200 mb-6">
                  Call us now or visit our restaurant for dine-in, takeout, or delivery. 
                  We're here to serve you the best pizza in town!
                </p>
                <Button 
                  size="lg" 
                  className="bg-accent-500 hover:bg-accent-600 text-white"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Call Now
                </Button>
              </div>
              {/* Contact Information Section (Moved down) */}
              <div>
                <h3 className="text-2xl font-semibold mb-6">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 mr-3 text-accent-400" />
                    <span>123 Pizza Street, Little Italy, NY 10013</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 mr-3 text-accent-400" />
                    <span>(555) 123-PIZZA</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 mr-3 text-accent-400" />
                    <span>info@nonnaspizzeria.com</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-3 text-accent-400" />
                    <div>
                      <p>Mon-Thu: 11am - 10pm</p>
                      <p>Fri-Sat: 11am - 11pm</p>
                      <p>Sun: 12pm - 9pm</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;