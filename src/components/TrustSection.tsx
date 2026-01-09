import { motion } from "framer-motion";
import { Heart, Smartphone, Sparkles } from "lucide-react";

export const TrustSection = () => {
  return (
    <section className="section-padding relative overflow-hidden bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950">
      {/* Subtle warm glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      {/* Decorative floating elements */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.15 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="absolute top-10 left-10 w-32 h-32 bg-primary/30 rounded-full blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 0.1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.3 }}
        className="absolute bottom-10 right-10 w-48 h-48 bg-primary/20 rounded-full blur-3xl"
      />

      <div className="container-narrow relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          {/* Glowing heart icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full mb-8 shadow-[0_0_40px_rgba(251,146,60,0.3)]"
          >
            <Heart className="w-10 h-10 text-primary" fill="hsl(var(--primary) / 0.3)" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-stone-300 text-3xl sm:text-4xl font-bold text-cream-100 font-serif mb-6"
          >
            Made for Everyday Cooks
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-stone-300 max-w-2xl mx-auto text-lg leading-relaxed mb-8"
          >
            This app is designed to make everyday cooking easier - not more complicated.
            <br />
            <span className="text-primary/90">No ads. No pressure.</span> Just food ideas from what you already have.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-3 mb-8"
          >
            <span className="text-stone-300 inline-flex items-center gap-2 px-4 py-2 bg-stone-800/80 border border-primary/20 rounded-full text-sm text-cream-100">
              <Sparkles className="w-4 h-4 text-primary" />
              Simple & intuitive
            </span>
            <span className="text-stone-300 inline-flex items-center gap-2 px-4 py-2 bg-stone-800/80 border border-primary/20 rounded-full text-sm text-cream-100">
              <Heart className="w-4 h-4 text-primary" />
              Made with love
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-stone-300 inline-flex items-center gap-2 px-5 py-3 bg-primary/10 border border-primary/30 rounded-full text-sm text-cream-100 shadow-[0_0_20px_rgba(251,146,60,0.15)]"
          >
            <Smartphone className="w-4 h-4 text-primary" />
            Works best on mobile or tablet in the kitchen
          </motion.div>
        </motion.div>
      </div>

      {/* Top decorative curve */}
      <div className="absolute top-0 left-0 right-0 rotate-180" style={{ filter: 'drop-shadow(0 -4px 20px rgba(251,146,60,0.3))' }}>
        <svg viewBox="0 0 1440 40" fill="none" className="w-full">
          <defs>
            <linearGradient id="topCurveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary) / 0.5)" />
              <stop offset="50%" stopColor="hsl(var(--primary) / 0.65)" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.8)" />
            </linearGradient>
          </defs>
          <path d="M0 40V10C360 30 720 40 1080 25C1260 17 1380 8 1440 0V40H0Z" fill="url(#topCurveGradient)" />
        </svg>
      </div>

      {/* Bottom decorative curve */}
      <div className="absolute bottom-0 left-0 right-0" style={{ filter: 'drop-shadow(0 -4px 20px rgba(251,146,60,0.3))' }}>
        <svg viewBox="0 0 1440 40" fill="none" className="w-full">
          <defs>
            <linearGradient id="bottomCurveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary) / 0.5)" />
              <stop offset="50%" stopColor="hsl(var(--primary) / 0.65)" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.8)" />
            </linearGradient>
          </defs>
          <path d="M0 40V10C360 30 720 40 1080 25C1260 17 1380 8 1440 0V40H0Z" fill="url(#bottomCurveGradient)" />
        </svg>
      </div>
    </section>
  );
};
