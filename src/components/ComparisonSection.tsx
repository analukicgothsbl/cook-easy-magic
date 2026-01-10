import { motion } from "framer-motion";
import { Check, Star, BookOpen, Calendar, Download, Image, Flame, Settings } from "lucide-react";
import grilledChicken from "@/assets/grilled-chicken.jpg";

const freeFeatures = [
  "Generate 1 recipe idea",
  "Surprise-me cuisine",
  "Simple step-by-step instructions",
  "No login required",
];

const accountFeatures = [
  { icon: Star, text: "5 credits sign-up bonus for new recipes" },
  { icon: Star, text: "1 credit daily - bonus for new recipes" },
  { icon: BookOpen, text: "Dashboard overview" },
  { icon: Check, text: "Save favorite recipes" },
  { icon: BookOpen, text: "Make your own CookBook" },
  { icon: Calendar, text: "Plan what to cook tomorrow" },
  { icon: BookOpen, text: "Access open Library of recipes" },
  { icon: Image, text: "Allow recipe images" },
  { icon: Flame, text: "Recipe energy value (calories)" },
  { icon: Download, text: "Export shopping list (PDF)" },
  { icon: Settings, text: "Personalized settings" },
];

export const ComparisonSection = () => {
  return (
    <section className="section-padding relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={grilledChicken}
          alt="Delicious food"
          className="w-full h-full object-cover opacity-10 blur-xl scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
      </div>

      <div className="relative z-10 container-wide">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-serif mb-4">What's included?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Start cooking right away, or create a free account for the full experience
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Free Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card-warm p-6 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-12 bg-success-light rounded-full flex items-center justify-center text-2xl">
                🟢
              </span>
              <div>
                <h3 className="text-xl font-bold text-foreground">Without account</h3>
                <p className="text-sm text-muted-foreground">Perfect for quick inspiration</p>
              </div>
            </div>
            <ul className="space-y-4">
              {freeFeatures.map((feature, index) => (
                <motion.li
                  key={feature}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
                  className="flex items-center gap-3 text-foreground"
                >
                  <Check className="w-5 h-5 text-success flex-shrink-0" />
                  {feature}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Account Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="card-highlighted p-6 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-2xl">⭐</span>
              <div>
                <h3 className="text-xl font-bold text-foreground">With free account</h3>
                <p className="text-sm text-muted-foreground">Unlock the full experience</p>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              {accountFeatures.map((feature, index) => (
                <motion.li
                  key={feature.text}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                  className="flex items-center gap-3 text-foreground"
                >
                  <feature.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  {feature.text}
                </motion.li>
              ))}
            </ul>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full btn-primary">
              Create free account
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
