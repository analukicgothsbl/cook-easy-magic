import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Trash2, Loader2, Save, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TimeAvailable = Database['public']['Enums']['time_available'];
type DifficultyLevel = Database['public']['Enums']['difficulty_level'];
type CuisineType = Database['public']['Enums']['cuisine_type'];
type BudgetLevel = Database['public']['Enums']['budget_level'];

interface SettingsViewProps {
  activeTab: 'basic' | 'personalized';
}

interface UserOptions {
  time_available: TimeAvailable | null;
  difficulty: DifficultyLevel | null;
  cuisine: CuisineType | null;
  servings: number;
  budget_level: BudgetLevel | null;
  kids_friendly: boolean | null;
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

export function SettingsView({ activeTab }: SettingsViewProps) {
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Basic settings state
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
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

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Fetch user extended info
        const { data: extendedData } = await supabase
          .from('user_extended')
          .select('name')
          .eq('user_id', user.id)
          .single();

        if (extendedData?.name) {
          setDisplayName(extendedData.name);
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
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

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
      setCurrentPassword('');
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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {activeTab === 'basic' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Change Name */}
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
      ) : (
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
      )}
    </div>
  );
}
