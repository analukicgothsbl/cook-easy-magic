import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Trash2, Loader2, Save, Check, Sliders, CreditCard, Upload, Camera, DollarSign, Heart, Copy, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BuyCreditsModal } from './BuyCreditsModal';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TimeAvailable = Database['public']['Enums']['time_available'];
type DifficultyLevel = Database['public']['Enums']['difficulty_level'];
type CuisineType = Database['public']['Enums']['cuisine_type'];
type BudgetLevel = Database['public']['Enums']['budget_level'];
type CreditReason = Database['public']['Enums']['credit_reason'];
type CreditType = Database['public']['Enums']['credit_type'];
type AppRole = Database['public']['Enums']['app_role'];

type SettingsTab = 'basic' | 'personalized' | 'credit-usage' | 'credit-billing' | 'credit-manage';

interface UserOptions {
  time_available: TimeAvailable | null;
  difficulty: DifficultyLevel | null;
  cuisine: CuisineType | null;
  servings: number;
  budget_level: BudgetLevel | null;
  kids_friendly: boolean | null;
}

interface CreditUsageRow {
  id: string;
  type: CreditType;
  amount: number;
  reason: CreditReason;
  created_at: string;
}

interface CreditWallet {
  balance: number;
  dailyRemaining: number;
}

const cuisineOptions: { id: CuisineType; label: string }[] = [
  { id: 'any_surprise_me', label: 'Any – Surprise me' },
  { id: 'home_style_traditional', label: 'Home-style / Traditional' },
  { id: 'italian', label: 'Italian' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'asian', label: 'Asian' },
  { id: 'balkan', label: 'Balkan' },
  { id: 'healthy_light', label: 'Healthy – Light' },
  { id: 'comfort_food', label: 'Comfort food' },
];

const difficultyOptions: { id: DifficultyLevel; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

const budgetOptions: { id: BudgetLevel; label: string }[] = [
  { id: 'cheap', label: 'Cheap' },
  { id: 'normal', label: 'Normal' },
  { id: 'doesnt_matter', label: "Doesn't matter" },
];

const timeOptions: { id: TimeAvailable; label: string }[] = [
  { id: 'minimum', label: 'Minimum time' },
  { id: 'enough', label: 'Enough time' },
];

const settingsMenuItems = [
  { id: 'basic' as const, title: 'Basic', icon: User, adminOnly: false },
  { id: 'personalized' as const, title: 'Personalized Options', icon: Sliders, adminOnly: false },
  { id: 'credit-usage' as const, title: 'Credit Usage', icon: CreditCard, adminOnly: false },
  { id: 'credit-billing' as const, title: 'Credit Billing', icon: DollarSign, adminOnly: false },
  { id: 'credit-manage' as const, title: 'Credit Manage', icon: Shield, adminOnly: true },
];

const creditTypeOptions: { id: CreditType; label: string }[] = [
  { id: 'income', label: 'Income (+)' },
  { id: 'cost', label: 'Cost (-)' },
];

const creditReasonOptions: { id: CreditReason; label: string }[] = [
  { id: 'signup_bonus', label: 'Signup Bonus' },
  { id: 'friend_bonus', label: 'Friend Referral' },
  { id: 'generate_recipe', label: 'Recipe Generation' },
  { id: 'generate_recipe_image', label: 'Image Generation' },
  { id: 'bonus_credit', label: 'Bonus Credit' },
  { id: 'donate_bonus', label: 'Donation Bonus' },
  { id: 'purchased_credit', label: 'Purchased Credit' },
  { id: 'admin_bonus', label: 'Admin Bonus' },
];

const creditPackages = [
  { price: 1, credits: 10 },
  { price: 3, credits: 32 },
  { price: 5, credits: 55 },
  { price: 10, credits: 115 },
];

const formatReason = (reason: CreditReason): string => {
  const reasonMap: Record<CreditReason, string> = {
    signup_bonus: 'Signup Bonus',
    friend_bonus: 'Friend Referral',
    generate_recipe: 'Recipe Generation',
    generate_recipe_image: 'Image Generation',
    bonus_credit: 'Bonus Credit',
    admin_bonus: 'Admin Bonus',
    donate_bonus: 'Donation Bonus',
    purchased_credit: 'Purchased Credit',
    buy_credits_paypal: 'PayPal Purchase',
  };
  return reasonMap[reason] || reason;
};

interface SettingsViewProps {
  initialTab?: SettingsTab;
}

export function SettingsView({ initialTab }: SettingsViewProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'basic');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Basic settings state
  const [displayName, setDisplayName] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Personalized settings state
  const [options, setOptions] = useState<UserOptions>({
    time_available: null,
    difficulty: null,
    cuisine: null,
    servings: 2,
    budget_level: null,
    kids_friendly: null,
  });

  // Credit usage state
  const [creditUsage, setCreditUsage] = useState<CreditUsageRow[]>([]);
  const [wallet, setWallet] = useState<CreditWallet>({ balance: 0, dailyRemaining: 0 });

  // User role state
  const [userRole, setUserRole] = useState<AppRole | null>(null);

  // Credit manage state (admin only)
  const [allUsers, setAllUsers] = useState<{ user_id: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [manageType, setManageType] = useState<CreditType>('income');
  const [manageAmount, setManageAmount] = useState<string>('');
  const [manageReason, setManageReason] = useState<CreditReason>('admin_bonus');
  const [isManaging, setIsManaging] = useState(false);

  // Buy credits modal state
  const [isBuyCreditsModalOpen, setIsBuyCreditsModalOpen] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Fetch user extended info including role
        const { data: extendedData } = await supabase
          .from('user_extended')
          .select('name, profile_picture, role')
          .eq('user_id', user.id)
          .single();

        if (extendedData) {
          if (extendedData.name) setDisplayName(extendedData.name);
          if (extendedData.profile_picture) setProfilePicture(extendedData.profile_picture);
          if (extendedData.role) setUserRole(extendedData.role);
        }

        // Fetch user options
        const { data: optionsData } = await supabase
          .from('user_options')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (optionsData) {
          setOptions({
            time_available: optionsData.time_available,
            difficulty: optionsData.difficulty,
            cuisine: optionsData.cuisine,
            servings: optionsData.servings || 2,
            budget_level: optionsData.budget_level,
            kids_friendly: optionsData.kids_friendly,
          });
        }

        // Fetch credit usage
        const { data: usageData } = await supabase
          .from('credit_usage')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (usageData) {
          setCreditUsage(usageData);
        }

        // Fetch credit wallet
        const { data: walletData } = await supabase
          .from('credit_wallet')
          .select('balance, daily_remaining')
          .eq('user_id', user.id)
          .maybeSingle();

        setWallet({
          balance: walletData?.balance || 0,
          dailyRemaining: walletData?.daily_remaining || 0,
        });
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }

    setIsUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      // Update user_extended with profile picture URL
      const { error: updateError } = await supabase
        .from('user_extended')
        .update({ profile_picture: publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfilePicture(publicUrl);
      toast.success('Profile picture updated successfully');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdateName = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('user_extended')
        .update({ name: displayName, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Name updated successfully');
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Failed to update name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );

    if (!confirmed) return;

    toast.error('Account deletion requires admin support. Please contact us.');
  };

  const handleSaveOptions = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('user_options')
        .update({
          ...options,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Preferences saved successfully');
    } catch (error) {
      console.error('Error saving options:', error);
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch all users for admin credit management
  useEffect(() => {
    const fetchAllUsers = async () => {
      if (!user || userRole !== 'admin') return;

      try {
        // Fetch all users from user_extended and their auth emails
        const { data: usersData, error } = await supabase
          .from('user_extended')
          .select('user_id');

        if (error) throw error;

        // We need to get emails - but we can't access auth.users directly
        // So we'll use a workaround by fetching from credit_wallet or showing user_id
        // For now, let's fetch user emails from the auth context or use user_id
        if (usersData) {
          // Map user_id to email - we'll need to get this from somewhere
          // For admin to see all users, we need to create an edge function or use a view
          // For now, let's just use user_id as identifier and admin can input email
          setAllUsers(usersData.map(u => ({ user_id: u.user_id, email: u.user_id })));
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchAllUsers();
  }, [user, userRole]);

  const handleManageCredits = async () => {
    if (!user || userRole !== 'admin') {
      toast.error('Admin access required');
      return;
    }

    if (!selectedUserId) {
      toast.error('Please enter a user email');
      return;
    }

    const amount = parseFloat(manageAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsManaging(true);

    try {
      // First, find the user_id by email from auth (we need to look up by email)
      // Since we can't access auth.users directly, we'll assume selectedUserId is the email
      // and we need an edge function to get the user_id from email
      // For now, let's check if the email exists in user_extended by querying differently
      
      // Get user_id from email by calling Supabase with service role (edge function needed)
      // Workaround: Admin enters the user's email, we search user_extended or try to match
      
      // Let's try to get user by looking at auth.users via an RPC or just use the input as user_id for testing
      // For a proper implementation, you'd need an edge function
      
      // For now, let's search by the pattern in user_extended or assume it's direct user_id input
      let targetUserId = selectedUserId;
      
      // If it looks like an email, try to find the user
      if (selectedUserId.includes('@')) {
        // We need to search - but user_extended doesn't have email
        // This requires an edge function to look up auth.users
        // For now, show error that we need user_id
        toast.error('Please enter the user ID (UUID). Email lookup requires additional setup.');
        setIsManaging(false);
        return;
      }

      // Insert credit usage record
      const { error: usageError } = await supabase
        .from('credit_usage')
        .insert({
          user_id: targetUserId,
          type: manageType,
          amount: amount,
          reason: manageReason,
          created_at: new Date().toISOString(),
        });

      if (usageError) throw usageError;

      // Get current wallet balance
      const { data: currentWallet } = await supabase
        .from('credit_wallet')
        .select('balance')
        .eq('user_id', targetUserId)
        .maybeSingle();

      const currentBalance = currentWallet?.balance || 0;
      const newBalance = manageType === 'income' 
        ? currentBalance + amount 
        : currentBalance - amount;

      // Update or insert wallet
      if (currentWallet) {
        const { error: walletError } = await supabase
          .from('credit_wallet')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', targetUserId);

        if (walletError) throw walletError;
      } else {
        const { error: walletError } = await supabase
          .from('credit_wallet')
          .insert({
            user_id: targetUserId,
            balance: newBalance,
            daily_remaining: 0,
            updated_at: new Date().toISOString(),
          });

        if (walletError) throw walletError;
      }

      toast.success(`Successfully ${manageType === 'income' ? 'added' : 'deducted'} ${amount} credits`);
      
      // Reset form
      setSelectedUserId('');
      setManageAmount('');
      setManageType('income');
      setManageReason('admin_bonus');
    } catch (error) {
      console.error('Error managing credits:', error);
      toast.error('Failed to manage credits. Check if user ID is valid.');
    } finally {
      setIsManaging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderBasicSettings = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Profile Picture */}
      <div className="card-warm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Profile Picture</h3>
        </div>
        <div className="flex items-center gap-6">
          <Avatar className="w-20 h-20 border-2 border-border">
            <AvatarImage src={profilePicture || undefined} alt="Profile" />
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="btn-primary flex items-center gap-2"
            >
              {isUploadingImage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload Photo
            </button>
            <p className="text-xs text-muted-foreground">Max 2MB, JPG or PNG</p>
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div className="card-warm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Display Name</h3>
        </div>
        <div className="space-y-4">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="input-warm"
          />
          <button
            onClick={handleUpdateName}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Name
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="card-warm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Change Password</h3>
        </div>
        <div className="space-y-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="input-warm"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="input-warm"
          />
          <button
            onClick={handleUpdatePassword}
            disabled={isSaving || !newPassword || !confirmPassword}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Update Password
          </button>
        </div>
      </div>

      {/* Delete Account */}
      <div className="card-warm p-6 border-destructive/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Delete Account</h3>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          onClick={handleDeleteAccount}
          className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive/20 transition-colors"
        >
          Delete Account
        </button>
      </div>
    </motion.div>
  );

  const renderPersonalizedSettings = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-warm p-6"
    >
      <h3 className="text-lg font-semibold text-foreground mb-6">Default Recipe Preferences</h3>
      
      <div className="space-y-6">
        {/* Time Available */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Time Available
          </label>
          <div className="flex flex-wrap gap-2">
            {timeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setOptions({ ...options, time_available: option.id })}
                className={`pill-button ${
                  options.time_available === option.id ? 'pill-button-active' : 'pill-button-inactive'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Difficulty
          </label>
          <div className="flex flex-wrap gap-2">
            {difficultyOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setOptions({ ...options, difficulty: option.id })}
                className={`pill-button ${
                  options.difficulty === option.id ? 'pill-button-active' : 'pill-button-inactive'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cuisine */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Cuisine
          </label>
          <div className="flex flex-wrap gap-2">
            {cuisineOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setOptions({ ...options, cuisine: option.id })}
                className={`pill-button ${
                  options.cuisine === option.id ? 'pill-button-active' : 'pill-button-inactive'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Servings */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Servings
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={20}
              value={options.servings}
              onChange={(e) => setOptions({ ...options, servings: parseInt(e.target.value) || 2 })}
              className="w-24 px-4 py-3 rounded-xl border-2 bg-secondary border-border focus:border-primary focus:outline-none text-center font-medium"
            />
            <span className="text-muted-foreground">people</span>
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Budget
          </label>
          <div className="flex flex-wrap gap-2">
            {budgetOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setOptions({ ...options, budget_level: option.id })}
                className={`pill-button ${
                  options.budget_level === option.id ? 'pill-button-active' : 'pill-button-inactive'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kids Friendly */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Kids Friendly
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setOptions({ ...options, kids_friendly: true })}
              className={`pill-button flex items-center gap-2 ${
                options.kids_friendly === true ? 'pill-button-active' : 'pill-button-inactive'
              }`}
            >
              {options.kids_friendly === true && <Check className="w-4 h-4" />}
              Yes
            </button>
            <button
              onClick={() => setOptions({ ...options, kids_friendly: false })}
              className={`pill-button flex items-center gap-2 ${
                options.kids_friendly === false ? 'pill-button-active' : 'pill-button-inactive'
              }`}
            >
              {options.kids_friendly === false && <Check className="w-4 h-4" />}
              No
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveOptions}
          disabled={isSaving}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Preferences
        </button>
      </div>
    </motion.div>
  );

  const renderCreditUsage = () => {
    const totalCredits = wallet.balance + wallet.dailyRemaining;
    const maxDisplayCredits = Math.max(totalCredits, 10);
    const balancePercent = (wallet.balance / maxDisplayCredits) * 100;
    const dailyPercent = (wallet.dailyRemaining / maxDisplayCredits) * 100;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Current Balance Card */}
        <div className="card-warm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Current Balance</h3>
            <span className="text-sm text-muted-foreground">
              {totalCredits.toFixed(2)} credits left
            </span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            {/* Balance portion (blue) */}
            <div
              className="absolute left-0 top-0 h-full bg-primary transition-all duration-500"
              style={{ width: `${balancePercent}%` }}
            />
            {/* Daily remaining portion (lighter blue/cyan) */}
            <div
              className="absolute top-0 h-full bg-sky-400 transition-all duration-500"
              style={{ left: `${balancePercent}%`, width: `${dailyPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span>Balance: {wallet.balance.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span>Daily Bonus: {wallet.dailyRemaining.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Credit Usage History */}
        <div className="card-warm p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Credit Usage History</h3>
      
      {creditUsage.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No credit usage yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditUsage.map((usage) => (
                <TableRow key={usage.id}>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      usage.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {usage.type === 'income' ? '+' : '-'}
                    </span>
                  </TableCell>
                  <TableCell className={`font-medium ${
                    usage.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {usage.type === 'income' ? '+' : '-'}{usage.amount}
                  </TableCell>
                  <TableCell>{formatReason(usage.reason)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(usage.created_at), 'MMM d, yyyy HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
        </div>
      </motion.div>
    );
  };

  const renderCreditBilling = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Pricing Table */}
      <div className="card-warm p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Credit Packages</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Price</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditPackages.map((pkg) => (
                <TableRow key={pkg.price}>
                  <TableCell className="font-medium">${pkg.price}</TableCell>
                  <TableCell className="text-primary font-semibold">{pkg.credits} credits</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {(pkg.credits / pkg.price).toFixed(1)} credits/$
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <button
          onClick={() => setIsBuyCreditsModalOpen(true)}
          className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          Buy more credits
        </button>
      </div>

      {/* Donation Section */}
      <div className="card-warm p-6 border-2 border-primary/20">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Heart className="w-6 h-6 text-primary" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            Donate and get extra <span className="text-primary">20%</span> credits
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Support our project and receive bonus credits as a thank you!
          </p>
        </div>

        {/* Copy-paste identification text */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-2">
            Please paste this into the Ko-fi message so I can add your credits fast.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-background rounded border border-border text-sm font-mono text-foreground break-all">
              CookMaster | {user?.email} | +20% credits
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`CookMaster | ${user?.email} | +20% credits`);
                toast.success("Copied to clipboard!");
              }}
              className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://ko-fi.com/settrendcode"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-3 bg-[#0070ba] hover:bg-[#005ea6] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-lg">💳</span>
            Donate with PayPal
          </a>
          <a
            href="https://ko-fi.com/settrendcode"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-3 bg-[#ff5e5b] hover:bg-[#e54e4b] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-lg">☕</span>
            Donate with credit card (Ko-fi)
          </a>
        </div>
      </div>
    </motion.div>
  );

  const renderCreditManage = () => {
    const isAdmin = userRole === 'admin';

    if (!isAdmin) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-warm p-6"
        >
          <div className="text-center py-8">
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Admin access required</p>
            <p className="text-sm text-muted-foreground mt-1">
              This section is only available to administrators.
            </p>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="card-warm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Manage User Credits</h3>
              <p className="text-sm text-muted-foreground">Add or deduct credits for any user</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* User ID Input */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                User ID (UUID)
              </label>
              <input
                type="text"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder="Enter user ID (e.g., 123e4567-e89b-12d3-a456-426614174000)"
                className="input-warm w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find user ID in the database user_extended table
              </p>
            </div>

            {/* Credit Type */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Type
              </label>
              <Select value={manageType} onValueChange={(value) => setManageType(value as CreditType)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {creditTypeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={manageAmount}
                onChange={(e) => setManageAmount(e.target.value)}
                placeholder="0.00"
                className="input-warm w-full"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Reason
              </label>
              <Select value={manageReason} onValueChange={(value) => setManageReason(value as CreditReason)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {creditReasonOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleManageCredits}
              disabled={isManaging || !selectedUserId || !manageAmount}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {isManaging ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {manageType === 'income' ? 'Add Credits' : 'Deduct Credits'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'basic':
        return renderBasicSettings();
      case 'personalized':
        return renderPersonalizedSettings();
      case 'credit-usage':
        return renderCreditUsage();
      case 'credit-billing':
        return renderCreditBilling();
      case 'credit-manage':
        return renderCreditManage();
      default:
        return renderBasicSettings();
    }
  };

  return (
    <>
      <div className="flex h-full">
        {/* Left Sub-Menu (1/3) */}
        <div className="w-1/3 max-w-[280px] border-r border-border p-4 bg-card/50">
          <nav className="space-y-1">
            {settingsMenuItems.map((item) => {
              const isAdminOnly = item.adminOnly;
              const isDisabled = isAdminOnly && userRole !== 'admin';
              
              return (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && setActiveTab(item.id)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === item.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : isDisabled
                      ? 'text-muted-foreground/50 cursor-not-allowed'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.title}</span>
                  {isAdminOnly && (
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                      userRole === 'admin' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      Admin
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Content (2/3) */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Buy Credits Modal */}
      <BuyCreditsModal 
        isOpen={isBuyCreditsModalOpen} 
        onClose={() => setIsBuyCreditsModalOpen(false)} 
      />
    </>
  );
}
