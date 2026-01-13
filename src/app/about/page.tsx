import Link from "next/link";
import { Metadata } from "next";

// Static page - no dynamic data needed
export const dynamic = "force-static";
export const revalidate = false; // Never revalidate - fully static

export const metadata: Metadata = {
  title: "About Us | Nova Tourney",
  description: "Learn about Nova Tourney - India's premier esports tournament platform for competitive mobile gaming.",
  openGraph: {
    title: "About Us | Nova Tourney",
    description: "India's premier esports tournament platform for competitive mobile gaming.",
    type: "website",
  },
};

const TEAM_VALUES = [
  {
    icon: "🎯",
    title: "Fair Competition",
    description: "We ensure a level playing field for all participants with strict anti-cheat measures and transparent rules.",
  },
  {
    icon: "🔒",
    title: "Security First",
    description: "Your data and transactions are protected with industry-standard encryption and security protocols.",
  },
  {
    icon: "🤝",
    title: "Community Driven",
    description: "We listen to our players and organizers, continuously improving based on community feedback.",
  },
  {
    icon: "⚡",
    title: "Innovation",
    description: "We leverage cutting-edge technology to deliver the best tournament experience possible.",
  },
];

const STATS = [
  { label: "Active Players", value: "10,000+", icon: "👥" },
  { label: "Tournaments Hosted", value: "500+", icon: "🏆" },
  { label: "Prize Money Distributed", value: "₹25L+", icon: "💰" },
  { label: "Games Supported", value: "4+", icon: "🎮" },
];

const SUPPORTED_GAMES = [
  { name: "Free Fire", icon: "🔥" },
  { name: "PUBG Mobile", icon: "🎯" },
  { name: "Valorant", icon: "⚔️" },
  { name: "COD Mobile", icon: "🔫" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            About <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500">Nova Tourney</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            India&apos;s premier esports tournament platform, empowering gamers to compete, connect, and conquer.
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 mb-8">
          <div className="prose prose-invert max-w-none space-y-8">
            {/* Our Story */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>📖</span> Our Story
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Nova Tourney was founded in 2024 with a simple mission: to make competitive gaming accessible to everyone in India. 
                We noticed that while millions of Indians play mobile games daily, there was a lack of organized, trustworthy 
                platforms where players could showcase their skills and compete for real prizes.
              </p>
              <p className="text-gray-300 leading-relaxed mt-4">
                What started as a small community of passionate gamers has grown into a thriving ecosystem of players, 
                teams, and tournament organizers. Today, Nova Tourney hosts hundreds of tournaments every month across 
                popular titles like Free Fire, PUBG Mobile, Valorant, and COD Mobile.
              </p>
            </section>

            {/* Mission */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>🚀</span> Our Mission
              </h2>
              <p className="text-gray-300 leading-relaxed">
                Our mission is to democratize esports in India by providing a secure, fair, and user-friendly platform 
                where gamers of all skill levels can participate in competitive tournaments. We believe that every 
                gamer deserves the opportunity to test their skills, earn recognition, and win prizes - regardless 
                of their background or location.
              </p>
            </section>

            {/* What We Offer */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>🎮</span> What We Offer
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-2">For Players</h3>
                  <ul className="text-gray-300 space-y-2 text-sm">
                    <li>• Daily and weekly tournaments with real cash prizes</li>
                    <li>• Secure wallet system for easy deposits and withdrawals</li>
                    <li>• Team management and player matching features</li>
                    <li>• Leaderboards and skill-based rankings</li>
                    <li>• Real-time match updates and notifications</li>
                  </ul>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-2">For Organizers</h3>
                  <ul className="text-gray-300 space-y-2 text-sm">
                    <li>• Easy tournament creation and management tools</li>
                    <li>• Automated bracket generation and scheduling</li>
                    <li>• Built-in payment processing and prize distribution</li>
                    <li>• Player verification and anti-cheat measures</li>
                    <li>• Detailed analytics and reporting</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Supported Games */}
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>🕹️</span> Supported Games
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {SUPPORTED_GAMES.map((game) => (
                  <div
                    key={game.name}
                    className="bg-gray-700/50 rounded-lg p-4 text-center hover:bg-gray-700 transition"
                  >
                    <span className="text-3xl block mb-2">{game.icon}</span>
                    <span className="text-white font-medium">{game.name}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-gray-800 rounded-lg p-6 text-center"
            >
              <span className="text-3xl block mb-2">{stat.icon}</span>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Values Section */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TEAM_VALUES.map((value) => (
              <div
                key={value.title}
                className="bg-gray-700/50 rounded-lg p-6"
              >
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3">{value.icon}</span>
                  <h3 className="text-lg font-medium text-white">{value.title}</h3>
                </div>
                <p className="text-gray-300 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <span>🏢</span> Company Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300">
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Registered Name</h3>
              <p>Nova Tourney</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Founded</h3>
              <p>2024</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Headquarters</h3>
              <p>India</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-2">Industry</h3>
              <p>Esports &amp; Gaming Technology</p>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Have Questions?</h2>
          <p className="text-gray-300 mb-6">
            We&apos;d love to hear from you. Reach out to our team for any inquiries.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium rounded-lg hover:opacity-90 transition"
            >
              Contact Us
            </Link>
            <Link
              href="/tournaments"
              className="px-6 py-3 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition border border-white/20"
            >
              Browse Tournaments
            </Link>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>
            Read our{" "}
            <Link href="/privacy-policy" className="text-orange-500 hover:underline">
              Privacy Policy
            </Link>
            {" • "}
            <Link href="/terms" className="text-orange-500 hover:underline">
              Terms of Service
            </Link>
            {" • "}
            <Link href="/refund-policy" className="text-orange-500 hover:underline">
              Refund Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
