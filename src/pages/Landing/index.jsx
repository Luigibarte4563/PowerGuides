import Hero from './sections/Hero';
import Features from './sections/Features';
import HowItWorks from './sections/HowItWorks';
import Safety from './sections/Safety';
import CtaBanner from './sections/CtaBanner';

/** Phase 1 - public landing page. */
export default function Landing() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Safety />
      <CtaBanner />
    </>
  );
}
