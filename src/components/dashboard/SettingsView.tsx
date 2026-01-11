import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Trash2, Loader2, Save, Check, Sliders, CreditCard, Upload, Camera, DollarSign, Heart, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

type TimeAvailable = Database['public']['Enums']['time_available'];
type DifficultyLevel = Database['public']['Enums']['difficulty_level'];
type CuisineType = Database['public']['Enums']['cuisine_type'];
type BudgetLevel = Database['public']['Enums']['budget_level'];
type CreditReason = Database['public']['Enums']['credit_reason'];
type CreditType = Database['public']['Enums']['credit_type'];

type SettingsTab = 'basic' | 'personalized' | 'credit-usage' | 'credit-billing';

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
  { id: 'basic' as const, title: 'Basic', icon: User },
  { id: 'personalized' as const, title: 'Personalized Options', icon: Sliders },
  { id: 'credit-usage' as const, title: 'Credit Usage', icon: CreditCard },
  { id: 'credit-billing' as const, title: 'Credit Billing', icon: DollarSign },
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
  };
  return reasonMap[reason] || reason;
};

export function SettingsView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');
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

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Fetch user extended info
        const { data: extendedData } = await supabase
          .from('user_extended')
          .select('name, profile_picture')
          .eq('user_id', user.id)
          .single();

        if (extendedData) {
          if (extendedData.name) setDisplayName(extendedData.name);
          if (extendedData.profile_picture) setProfilePicture(extendedData.profile_picture);
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
      default:
        return renderBasicSettings();
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sub-Menu (1/3) */}
      <div className="w-1/3 max-w-[280px] border-r border-border p-4 bg-card/50">
        <nav className="space-y-1">
          {settingsMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeTab === item.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.title}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right Content (2/3) */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
