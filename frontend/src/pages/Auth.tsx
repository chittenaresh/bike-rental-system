import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bike, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { authAPI, setAuthToken } from '@/lib/api';
import { SEO } from '@/components/SEO';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [otp, setOtp] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });

  useEffect(() => {
    const mode = searchParams.get('mode');
    setIsLogin(mode !== 'signup');
  }, [searchParams]);

  const validatePassword = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) return "Password must be at least 8 characters long";
    if (!hasUpperCase) return "Password must contain at least one uppercase letter";
    if (!hasLowerCase) return "Password must contain at least one lowercase letter";
    if (!hasNumber) return "Password must contain at least one number";
    if (!hasSpecialChar) return "Password must contain at least one special character";
    return null;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (email.length > 100) return "Email is too long (max 100 characters)";
    if (!emailRegex.test(email)) return "Please enter a valid email address (e.g., user@example.com)";
    return null;
  };

  const validateName = (name: string) => {
    if (!name) return "Full name is required";
    if (name.length < 2) return "Name is too short";
    if (name.length > 50) return "Name is too long (max 50 characters)";
    if (!/^[a-zA-Z\s]*$/.test(name)) return "Name should only contain alphabets and spaces";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Forgot Password Flow
    if (isForgotPassword) {
      setIsLoading(true);
      try {
        if (isResetting) {
          // Reset Password
          if (!otp || !formData.password || !formData.confirmPassword) {
            toast({ title: "Error", description: "Please enter OTP, new password, and confirm password", variant: "destructive" });
            return;
          }

          const passwordError = validatePassword(formData.password);
          if (passwordError) {
            toast({ title: "Weak Password", description: passwordError, variant: "destructive" });
            return;
          }

          if (formData.password !== formData.confirmPassword) {
            toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
            return;
          }
          await authAPI.resetPassword(formData.email, otp, formData.password);
          toast({ title: "Success", description: "Password reset successfully! Please login." });
          setIsForgotPassword(false);
          setIsResetting(false);
          setOtp('');
          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        } else {
          // Request Reset
          const emailError = validateEmail(formData.email);
          if (emailError) {
            toast({ title: "Error", description: emailError, variant: "destructive" });
            return;
          }
          const res = await authAPI.forgotPassword(formData.email);
          toast({ title: "Success", description: res.message });
          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
          setIsResetting(true);
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "An error occurred",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Normal Login/Signup Flow
    const errors: string[] = [];

    // Email Validation
    const emailError = validateEmail(formData.email);
    if (emailError) {
      errors.push("invalid mail address");
    }

    // Name Validation - Only for Signup
    if (!isLogin) {
      const nameError = validateName(formData.name);
      if (nameError) {
        errors.push(nameError);
      }
    }

    // Password Validation
    if (!isLogin) {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        errors.push(passwordError);
      }
    } else if (!formData.password) { // For login, check if password is empty
      errors.push("invalid password");
    }

    if (errors.length > 0) {
      let finalMessage = "";
      if (isLogin && errors.includes("invalid mail address") && errors.includes("invalid password")) {
        finalMessage = "invalid email and password";
      } else {
        finalMessage = errors.join(", ");
      }
      toast({ title: "Error", description: finalMessage, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        const data = await authAPI.login({ email: formData.email, password: formData.password });
        if (data?.token) setAuthToken(data.token);
        if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user));
        toast({
          title: "Success",
          description: "Logged in successfully!",
        });
        // Redirect based on role
        if (data.user?.role === 'superadmin') {
          navigate('/superadmin');
        } else if (data.user?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        const data = await authAPI.register({ email: formData.email, password: formData.password, name: formData.name });
        if (data?.token) setAuthToken(data.token);
        if (data?.user) localStorage.setItem('currentUser', JSON.stringify(data.user));
        toast({
          title: "Success",
          description: "Account created successfully! Welcome bonus of ₹500 added to your wallet.",
        });
        // Redirect based on role
        if (data.user?.role === 'superadmin') {
          navigate('/superadmin');
        } else if (data.user?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getHeaderText = () => {
    if (isForgotPassword) {
      return isResetting ? 'Reset Password' : 'Forgot Password';
    }
    return isLogin ? 'Welcome back' : 'Create account';
  };

  const getSubHeaderText = () => {
    if (isForgotPassword) {
      return isResetting ? 'Enter the OTP and your new password' : 'Enter your email to receive an OTP';
    }
    return isLogin ? 'Enter your credentials to access your account' : 'Sign up to start renting bikes today';
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-background">
      <SEO 
        title={isForgotPassword ? "Reset Password" : (isLogin ? "Login" : "Sign Up")}
        description={isForgotPassword ? "Reset your RideFlow account password." : (isLogin ? "Log in to your RideFlow account." : "Create a new RideFlow account.")}
        keywords="bike rental login, create account, RideFlow sign up, rental dashboard access"
        noindex={true}
      />

      {isForgotPassword ? (
        /* Separate Centered Layout for Forgot Password */
        <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 lg:p-16 gradient-dark overflow-y-auto">
          <div className="w-full max-w-md bg-background rounded-2xl p-6 md:p-10 shadow-2xl border animate-fade-in my-8">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="p-2 rounded-xl gradient-hero">
                <Bike className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">RideFlow</span>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-display font-bold mb-2">
                {getHeaderText()}
              </h1>
              <p className="text-muted-foreground">
                {getSubHeaderText()}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().trim();
                    if (value.length <= 100) {
                      setFormData({ ...formData, email: value });
                    }
                  }}
                  maxLength={100}
                  disabled={isResetting}
                  required
                />
              </div>

              {isResetting && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="otp">OTP Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="hide-password-toggle pr-10"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="hide-password-toggle pr-10"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading 
                  ? 'Please wait...' 
                  : isResetting ? 'Reset Password' : 'Send OTP'
                }
              </Button>
              
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full mt-2" 
                onClick={() => {
                  setIsForgotPassword(false);
                  setIsResetting(false);
                  setOtp('');
                  setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
                }}
              >
                Back to Login
              </Button>
            </form>
          </div>
        </main>
      ) : (
        /* Original Side-by-Side Layout for Login/Signup */
        <div className="grid lg:grid-cols-2 min-h-screen">
          <main className="flex flex-col min-h-full">
            <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-16 py-12 md:py-20">
              <div className="w-full max-w-sm space-y-8 animate-fade-in">
              {/* Back Link */}
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </Link>

              {/* Logo */}
              <div className="flex items-center gap-2 mb-8">
                <div className="p-2 rounded-xl gradient-hero">
                  <Bike className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="font-display font-bold text-xl">RideFlow</span>
              </div>

              {/* Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-display font-bold mb-2">
                  {getHeaderText()}
                </h1>
                <p className="text-muted-foreground">
                  {getSubHeaderText()}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field - Only for Signup */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^[a-zA-Z\s]*$/.test(value)) {
                          setFormData({ ...formData, name: value.slice(0, 50) });
                        }
                      }}
                      maxLength={50}
                    />
                  </div>
                )}

                {/* Email Field - Login/Signup */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().trim();
                      if (value.length <= 100) {
                        setFormData({ ...formData, email: value });
                      }
                    }}
                    maxLength={100}
                    required
                  />
                </div>

                {/* Password Field - Login, Signup */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="hide-password-toggle pr-10"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link - Only on Login */}
                {isLogin && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => {
                        if (!formData.email) {
                          toast({
                            title: "Error",
                            description: "Please enter your email address first.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setIsForgotPassword(true);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading 
                    ? 'Please wait...' 
                    : (isLogin ? 'Sign In' : 'Create Account')
                  }
                </Button>
              </form>

              {/* Toggle Login/Signup */}
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  className="text-primary font-medium hover:underline"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
          </main>

          {/* Right side: Image/Content */}
          <div className="flex flex-1 gradient-dark items-center justify-center p-12 overflow-y-auto">
            <div className="max-w-md text-center py-12">
              <div className="w-24 h-24 rounded-2xl gradient-hero flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
                <Bike className="h-12 w-12 text-primary-foreground" />
              </div>
              <h2 className="text-3xl font-display font-bold text-secondary-foreground mb-4">
                Start Your Journey
              </h2>
              <p className="text-muted-foreground">
                Join thousands of riders exploring their cities with RideFlow.
                Premium bikes, flexible rentals, unforgettable adventures.
              </p>

              {/* Feature List */}
              <div className="mt-8 space-y-4 text-left">
                {[
                  'Access to 50+ premium bikes',
                  'Digital wallet for easy payments',
                  'Earn rewards on every ride',
                  '24/7 customer support',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-secondary-foreground">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
