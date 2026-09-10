"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, Activity, Map, Zap, Snowflake, BarChart3, Database, FlaskConical } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1A] selection:bg-[#EF9F27] selection:text-white flex flex-col font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 border-b border-[#E0E0DB] bg-white/80 backdrop-blur-md z-50 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EF9F27] flex items-center justify-center">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <span className="font-800 text-lg tracking-tight">ChillShield</span>
            <span className="text-[10px] font-800 uppercase tracking-widest text-[#6B6B65] ml-1">AI</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-600 text-[#6B6B65]">
          <Link href="#features" className="hover:text-[#1C1C1A] transition-colors">Platform</Link>
          <Link href="#impact" className="hover:text-[#1C1C1A] transition-colors">Impact</Link>
          <Link href="#model" className="hover:text-[#1C1C1A] transition-colors">ML Engine</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/overview" className="px-5 py-2 rounded-md bg-[#EF9F27] text-white font-600 text-sm hover:bg-[#D98A1E] transition-all shadow-sm hover:shadow">
            Launch Control Tower
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 lg:px-12 flex flex-col items-center text-center w-full min-h-[85vh] justify-center border-b border-[#E0E0DB]">
        {/* Background Image & Overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{ backgroundImage: "url('/truck-bg.jpg')" }}
        />
        
        <div className="relative z-10 flex flex-col items-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EEF5E1]/90 backdrop-blur-sm border border-[#C2DB8D] text-[#4A7018] text-xs font-700 mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#639922] animate-pulse" />
            Platform Demo
          </div>
          
          <motion.h1 
            className="text-5xl md:text-7xl font-800 tracking-tight leading-[1.1] mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            Zero Spoilage.<br />
            <motion.span 
              className="text-transparent bg-clip-text"
              initial={{ backgroundImage: "linear-gradient(to right, #EF9F27, #EF9F27)" }}
              animate={{ backgroundImage: "linear-gradient(to right, #EF9F27, #1D9E75)" }}
              transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.8 }}
            >
              Predictive Intelligence.
            </motion.span>
          </motion.h1>
          
          <motion.p 
            className="text-lg md:text-xl text-[#1C1C1A] max-w-2xl mb-10 leading-relaxed font-500 drop-shadow-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            Stop reacting to temperature excursions. ChillShield AI predicts cold-chain failures before they happen using real-time IoT telematics and Gradient Boosting ML.
          </motion.p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/overview" className="px-8 py-3.5 rounded-lg bg-[#1C1C1A] text-white font-600 text-base flex items-center gap-2 hover:bg-[#2A2A28] transition-all hover:-translate-y-0.5 shadow-lg">
            Enter Dashboard <ArrowRight size={18} />
          </Link>
          <Link href="/simulator" className="px-8 py-3.5 rounded-lg bg-white border border-[#E0E0DB] text-[#1C1C1A] font-600 text-base flex items-center gap-2 hover:bg-[#F2F2EF] transition-all">
            <FlaskConical size={18} /> Try What-If Simulator
          </Link>
        </div>

        {/* Dashboard Preview Image */}
        <div className="w-full mt-20 relative rounded-2xl overflow-hidden border border-[#E0E0DB] shadow-2xl bg-white p-2">
           <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
           <div className="aspect-[16/9] bg-[#F2F2EF] rounded-xl overflow-hidden relative flex items-center justify-center">
              {/* Abstract representation of dashboard */}
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-4 p-4 opacity-30">
                 <div className="col-span-1 row-span-3 bg-white rounded-lg border border-[#E0E0DB]" />
                 <div className="col-span-3 row-span-1 bg-white rounded-lg border border-[#E0E0DB]" />
                 <div className="col-span-2 row-span-2 bg-white rounded-lg border border-[#E0E0DB]" />
                 <div className="col-span-1 row-span-2 bg-[#EF9F27] rounded-lg border border-[#E0E0DB]" />
              </div>
              <div className="z-20 text-center">
                <ShieldCheck size={64} className="text-[#EF9F27] mx-auto mb-4 opacity-80" />
                <h3 className="text-2xl font-800 text-[#1C1C1A]">State-Driven Interface</h3>
                <p className="text-[#6B6B65]">Powered by Zustand & Real ML</p>
              </div>
           </div>
        </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white border-y border-[#E0E0DB]">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-800 mb-4">The Complete Cold-Chain Loop</h2>
            <p className="text-[#6B6B65] max-w-2xl mx-auto">Monitor → Predict → Explain → Simulate → Recommend → Act</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-[#FAFAF8] border border-[#E0E0DB] hover:border-[#EF9F27] transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-[#EF9F27]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Activity className="text-[#EF9F27]" />
              </div>
              <h3 className="text-lg font-700 mb-2">Predictive Risk Scoring</h3>
              <p className="text-sm text-[#6B6B65] leading-relaxed">
                Gradient Boosting model calculates real-time risk of spoilage based on temperature drift, humidity, route delays, and cargo sensitivity.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-[#FAFAF8] border border-[#E0E0DB] hover:border-[#1D9E75] transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-[#1D9E75]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FlaskConical className="text-[#1D9E75]" />
              </div>
              <h3 className="text-lg font-700 mb-2">What-If Simulator</h3>
              <p className="text-sm text-[#6B6B65] leading-relaxed">
                Test interventions before acting. Divert to alternative routes or instruct drivers to restore cooling, and immediately see the revised ML risk prediction.
              </p>
            </div>
            
            <div className="p-6 rounded-xl bg-[#FAFAF8] border border-[#E0E0DB] hover:border-[#4A7018] transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-[#639922]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Map className="text-[#639922]" />
              </div>
              <h3 className="text-lg font-700 mb-2">Global Network Visibility</h3>
              <p className="text-sm text-[#6B6B65] leading-relaxed">
                A single unified state powers the control tower. Filter, sort, and identify critical shipments instantly with rich, color-coded risk bands.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 bg-[#1C1C1A] text-white border-t border-[#2A2A28] mt-auto">
        <div className="max-w-6xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-[#EF9F27]" />
            <span className="font-800 text-lg tracking-tight">ChillShield</span>
          </div>
          <div className="text-sm text-[#9B9B95]">
            Built for SIH 2026 Hackathon · Predictive Cold-Chain Risk
          </div>
          <Link href="/overview" className="text-sm font-600 text-[#EF9F27] hover:underline">
            Open Application
          </Link>
        </div>
      </footer>
    </div>
  );
}
