import { ExternalLink, Layers, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  {
    name: "Railway", category: "Application hosting",
    description: "Runs the live staff dashboard, guest pages and backend. Production releases are deployed here separately from GitHub.",
    links: [
      { label: "Railway project", href: "https://railway.com/project/7dcb739a-99dd-44c1-afa4-679b82681bb3" },
      { label: "Live application", href: "https://valet-s-production.up.railway.app/" },
    ],
  },
  {
    name: "Neon PostgreSQL", category: "Database",
    description: "Stores accounts, organizations, locations, tickets, schedules and sign-in sessions in our directly owned Neon database.",
    note: "Project: withered-sound-84014835 · Xen Tech IT",
    links: [{ label: "Neon console", href: "https://console.neon.tech/" }],
  },
  {
    name: "Cloudflare R2", category: "Private photo storage",
    description: "Stores vehicle and number-plate photos in the private valet-s-photos bucket. The app controls who can upload and view them.",
    links: [{ label: "Cloudflare dashboard", href: "https://dash.cloudflare.com/" }],
  },
  {
    name: "Google Cloud Vision", category: "Number-plate reading",
    description: "Extracts text from plate photos, including Japanese text, for the app to interpret. Uses our Valet-S project with paid billing enabled.",
    note: "Project: xen-valet-s",
    links: [{ label: "Vision API console", href: "https://console.cloud.google.com/apis/api/vision.googleapis.com/overview?project=xen-valet-s" }],
  },
  {
    name: "Gmail SMTP", category: "Outgoing email",
    description: "Provides outgoing email for verification codes and account messages through the configured Gmail SMTP account.",
    note: "SMTP authentication verified; actual email delivery still needs testing.",
    links: [{ label: "Open Gmail", href: "https://mail.google.com/" }],
  },
  {
    name: "GitHub", category: "Source code and change history",
    description: "Keeps the production code and its change history. Pushing code to GitHub does not automatically deploy it to Railway.",
    links: [{ label: "Valet-S repository", href: "https://github.com/Ivanjp7000/valet-s" }],
  },
  {
    name: "Local Mac & Valet Studio", category: "Editing, previews and backups",
    description: "Provides the local editing and testing environment. Current independent backup exports are manual and stored on this Mac.",
    note: "Local links work only on the development Mac while its services are running. Automatic off-device backups are not configured yet.",
    links: [
      { label: "Valet Studio", href: "http://127.0.0.1:9000/" },
      { label: "Local app preview", href: "http://127.0.0.1:5174/" },
    ],
  },
  {
    name: "Replit", category: "Domain and legacy deployment · temporary",
    description: "Still holds the valet-s.com registration and original deployment. The custom domain continues to route to Replit until the deferred DNS and domain work is completed.",
    note: "Keep the original services and domain registration intact until cutover. Use the Railway address for the migrated app.",
    links: [{ label: "Original Replit project", href: "https://replit.com/@IvanD07/ValetStream" }],
  },
];

export function InternalsPanel() {
  const { user } = useAuth();
  if (user?.role !== "superadmin") return null;

  return (
    <section className="space-y-6" aria-labelledby="internals-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="internals-heading" className="text-lg sm:text-2xl font-bold text-regis-navy">Internals</h2>
          <p className="mt-1 text-sm text-gray-600">The services behind Valet-S and where to manage them.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-regis-navy/5 px-3 py-1 text-xs font-medium text-regis-navy">
          <ShieldCheck size={14} /> Super Admin only
        </span>
      </div>
      <div className="rounded-xl border bg-white p-4 sm:p-5">
        <div className="flex items-center gap-2 font-medium text-regis-navy"><Layers size={18} /> How the services connect</div>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">Phone or browser → Railway → Neon for records, R2 for photos and Google Vision for plate reading. Gmail handles outgoing email. GitHub and Valet Studio support development and releases.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map(service => (
          <Card key={service.name} className="flex flex-col" data-testid="internals-service">
            <CardHeader className="pb-3">
              <p className="text-xs font-medium text-gray-500">{service.category}</p>
              <CardTitle className="text-lg text-regis-navy">{service.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-sm leading-relaxed text-gray-700">{service.description}</p>
              {service.note && <p className="text-xs leading-relaxed text-gray-500">{service.note}</p>}
              <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-2">
                {service.links.map(link => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-regis-navy underline underline-offset-4 hover:text-blue-700" aria-label={`${link.label} (opens in a new tab)`}>
                    {link.label}<ExternalLink size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-gray-500">Service directory · Live usage, cost and health statistics are not connected yet. Provider consoles may require a separate sign-in.</p>
    </section>
  );
}
