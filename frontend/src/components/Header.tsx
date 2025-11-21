import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { User, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { signInSchema, signUpSchema } from "@/lib/validationSchemas";

export const Header = () => {
  const { user, signOut, hasRole } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditor, setIsEditor] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);

  useEffect(() => {
    if (user) {
      setIsAdmin(hasRole('admin'));
      setIsEditor(hasRole('editor'));
      setCheckingRole(false);
    } else {
      setIsAdmin(false);
      setIsEditor(false);
      setCheckingRole(false);
    }
  }, [user, hasRole]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validationResult = signUpSchema.safeParse({
        email: email.trim(),
        password,
        fullName: fullName.trim()
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(', ');
        toast({
          title: "Validation Error",
          description: errors,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: validationResult.data.email,
        password: validationResult.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: validationResult.data.fullName,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Account created!",
        description: "You can now sign in with your credentials.",
      });
      setAuthOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validationResult = signInSchema.safeParse({
        email: email.trim(),
        password
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(', ');
        toast({
          title: "Validation Error",
          description: errors,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      if (error) throw error;

      toast({
        title: "Signed in successfully!",
      });
      setAuthOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out successfully",
    });
  };

  const showCreateListing = user && (isAdmin || isEditor) && !checkingRole;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary">
            M&A Platform
          </Link>
          
          <div className="flex items-center gap-3">
            {showCreateListing && (
              <>
                <Link to="/dashboard">
                  <Button variant="outline" className="gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link to="/admin/create">
                  <Button variant="outline">Create a Listing</Button>
                </Link>
              </>
            )}
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Dialog open={authOpen} onOpenChange={setAuthOpen}>
                <DialogTrigger asChild>
                  <Button>Sign In</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Authentication</DialogTitle>
                    <DialogDescription>
                      Sign in or create a new account to continue
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="signin" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="signin">Sign In</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    <TabsContent value="signin">
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signin-email">Email</Label>
                          <Input
                            id="signin-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signin-password">Password</Label>
                          <Input
                            id="signin-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? "Signing in..." : "Sign In"}
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="signup">
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-name">Full Name</Label>
                          <Input
                            id="signup-name"
                            type="text"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">Email</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password">Password</Label>
                          <Input
                            id="signup-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? "Creating account..." : "Sign Up"}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
