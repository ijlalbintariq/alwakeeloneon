import { useState } from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { useToast } from "@/hooks/use-toast";
import { Mail, PhoneCall, Clock, CheckCircle, Loader2, Send } from "lucide-react";

export default function ContactPage() {
  useDocumentHead({
    title: "Contact Us | Al Wakeelo — Legal Support & Consultation",
    description: "Contact Al Wakeelo and the Majnoon Studio team. Get platform support, ask billing questions, or schedule a professional chamber consultation.",
    path: "/contact",
  });

  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    caseType: "General Enquiry",
    caseDescription: "",
    urgency: "normal",
    consentToContact: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.city.trim() || !form.caseDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (form.caseDescription.length < 20) {
      toast({
        title: "Validation Error",
        description: "Please describe your request in at least 20 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/public-chat/submit-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSubmitted(true);
        toast({
          title: "Message Sent Successfully",
          description: "Thank you! We will get back to you shortly.",
        });
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to submit form.");
      }
    } catch (err: any) {
      toast({
        title: "Submission Failed",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10 fade-in">
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-bold uppercase tracking-widest">
          Get in Touch
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Contact Our Team <br/>
          <span className="text-primary italic">for Support &amp; Consultations</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Need technical assistance, have questions about your subscription, or want to consult with a High Court advocate? We are here to help.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-border">
        {/* Contact Info (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
            <h3 className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>Direct Channels</h3>
            
            <div className="flex items-start gap-3 text-sm">
              <Mail className="text-primary mt-0.5 flex-shrink-0" size={16} />
              <div>
                <p className="font-semibold text-foreground">Email Support</p>
                <a href="mailto:support@alwakeelo.com" className="text-muted-foreground hover:text-primary transition-colors text-xs">support@alwakeelo.com</a>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <PhoneCall className="text-primary mt-0.5 flex-shrink-0" size={16} />
              <div>
                <p className="font-semibold text-foreground">Phone &amp; WhatsApp</p>
                <a href="tel:00923358341897" className="text-muted-foreground hover:text-primary transition-colors text-xs">0092 335 834 1897</a>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <Clock className="text-primary mt-0.5 flex-shrink-0" size={16} />
              <div>
                <p className="font-semibold text-foreground">Support Hours</p>
                <p className="text-muted-foreground text-xs">Mon - Fri: 9:00 AM - 5:00 PM (PKT)</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-2">
            <h4 className="font-bold text-sm">Parent Company</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Al Wakeelo is operated by **Majnoon Studio**, developing modern software solutions for the Pakistani legal landscape.
            </p>
          </div>
        </div>

        {/* Contact Form (8 cols) */}
        <div className="lg:col-span-8">
          {submitted ? (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-8 text-center space-y-4 flex flex-col items-center justify-center min-h-[300px]">
              <CheckCircle className="text-emerald-400 animate-pulse" size={48} />
              <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Inquiry Submitted!</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                We have received your message. A representative from Al Wakeelo or Majnoon Studio will get back to you at your provided email/phone shortly.
              </p>
              <button 
                onClick={() => setSubmitted(false)}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-3xl border border-border bg-card/65 p-6 md:p-8 space-y-5">
              <h3 className="font-bold text-xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Send a Message</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Name *</label>
                  <input
                    id="name"
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    placeholder="Enter full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address *</label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    placeholder="Enter email address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number *</label>
                  <input
                    id="phone"
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    placeholder="e.g. +923358341897"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="city" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City *</label>
                  <input
                    id="city"
                    required
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    placeholder="e.g. Lahore, Karachi, Islamabad"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="caseType" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Area of Inquiry</label>
                  <select
                    id="caseType"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    value={form.caseType}
                    onChange={(e) => setForm({ ...form, caseType: e.target.value })}
                  >
                    <option value="General Enquiry">General Enquiry</option>
                    <option value="Billing &amp; Subscriptions">Billing &amp; Subscriptions</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Chamber Legal Consultation">Chamber Legal Consultation</option>
                    <option value="Property Law Dispute">Property Law Dispute</option>
                    <option value="Criminal Defense/Bail">Criminal Defense/Bail</option>
                    <option value="Family / Divorce Law">Family / Divorce Law</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="urgency" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Urgency Level</label>
                  <select
                    id="urgency"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    value={form.urgency}
                    onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  >
                    <option value="low">Low (General question)</option>
                    <option value="normal">Normal</option>
                    <option value="high">High (Active court matter)</option>
                    <option value="urgent">Urgent (Police/Arrest emergency)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Describe your Request *</label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none"
                  placeholder="Explain your legal situation, technical request, or inquiry in detail (min 20 characters)..."
                  value={form.caseDescription}
                  onChange={(e) => setForm({ ...form, caseDescription: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Submitting Request...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
