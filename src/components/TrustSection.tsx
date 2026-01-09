import { motion } from "framer-motion";
import { Heart, Smartphone } from "lucide-react";

export const TrustSection = () => {
  return (
    <section className="section-padding bg-background">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6">
            <Heart className="w-8 h-8 text-primary" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-foreground font-serif mb-4">Made for Everyday Cooks</h2>

          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed mb-6">
            This app is designed to make everyday cooking easier - not more complicated.
            <br />
            No ads. No pressure. Just food ideas from what you already have.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary rounded-full text-sm text-muted-foreground">
            <Smartphone className="w-4 h-4" />
            Works best on mobile or tablet in the kitchen
          </div>
        </motion.div>
      </div>
    </section>
  );
};
