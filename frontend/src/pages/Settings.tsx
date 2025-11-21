import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

export default function Settings() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user && hasRole('admin');

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: userRoles?.filter(ur => ur.user_id === profile.id).map(ur => ur.role) || []
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error fetching users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string, action: 'add' | 'remove') => {
    try {
      // Get tenant_id
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", "sherwood")
        .single();

      if (!tenantData) throw new Error("Tenant not found");

      if (action === 'add') {
        const { error } = await supabase
          .from("user_roles")
          .insert({ 
            user_id: userId, 
            tenant_id: tenantData.id, 
            role: role as 'admin' | 'editor' | 'reviewer' | 'buyer'
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .match({ user_id: userId, role });

        if (error) throw error;
      }

      toast({
        title: "Role updated",
        description: `User role ${action === 'add' ? 'added' : 'removed'} successfully`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error updating role",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>You don't have permission to access settings.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage system settings and users</p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="system">System Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>Loading users...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Manage Roles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.full_name || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {user.roles.map(role => (
                                <Badge key={role} variant="secondary">{role}</Badge>
                              ))}
                              {user.roles.length === 0 && <span className="text-muted-foreground">No roles</span>}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Select
                              onValueChange={(value) => {
                                const [action, role] = value.split(':');
                                updateUserRole(user.id, role, action as 'add' | 'remove');
                              }}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Manage roles" />
                              </SelectTrigger>
                              <SelectContent>
                                {!user.roles.includes('admin') && (
                                  <SelectItem value="add:admin">Add Admin</SelectItem>
                                )}
                                {user.roles.includes('admin') && (
                                  <SelectItem value="remove:admin">Remove Admin</SelectItem>
                                )}
                                {!user.roles.includes('editor') && (
                                  <SelectItem value="add:editor">Add Editor</SelectItem>
                                )}
                                {user.roles.includes('editor') && (
                                  <SelectItem value="remove:editor">Remove Editor</SelectItem>
                                )}
                                {!user.roles.includes('reviewer') && (
                                  <SelectItem value="add:reviewer">Add Reviewer</SelectItem>
                                )}
                                {user.roles.includes('reviewer') && (
                                  <SelectItem value="remove:reviewer">Remove Reviewer</SelectItem>
                                )}
                                {!user.roles.includes('buyer') && (
                                  <SelectItem value="add:buyer">Add Buyer</SelectItem>
                                )}
                                {user.roles.includes('buyer') && (
                                  <SelectItem value="remove:buyer">Remove Buyer</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>Configure system-wide settings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">System settings will be added here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
