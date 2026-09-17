import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function DashboardLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </div>

      {/* Mobile header + sidebar sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 glass-nav mobile-safe-top px-4 py-3 flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" data-testid="mobile-menu-button">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="mobile-safe-top mobile-safe-bottom p-0 w-[min(18rem,86vw)]">
            <Sidebar onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-heading font-bold text-lg tracking-tight text-primary">SalãoZap</span>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-[4.5rem] md:pt-0">
        <div className="mobile-safe-bottom p-4 pb-8 md:p-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
