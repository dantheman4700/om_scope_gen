import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { users as usersApi, UserProfile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      const { users: data } = await usersApi.list();
      setUsers(data);
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
      if (action === 'add') {
        await usersApi.addRole(userId, role);
      } else {
        await usersApi.removeRole(userId, role);
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
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.full_name || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {u.roles.map(role => (
                                <Badge key={role} variant="secondary">{role}</Badge>
                              ))}
                              {u.roles.length === 0 && <span className="text-muted-foreground">No roles</span>}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Select
                              onValueChange={(value) => {
                                const [action, role] = value.split(':');
                                updateUserRole(u.id, role, action as 'add' | 'remove');
                              }}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Manage roles" />
                              </SelectTrigger>
                              <SelectContent>
                                {!u.roles.includes('admin') && (
                                  <SelectItem value="add:admin">Add Admin</SelectItem>
                                )}
                                {u.roles.includes('admin') && (
                                  <SelectItem value="remove:admin">Remove Admin</SelectItem>
                                )}
                                {!u.roles.includes('editor') && (
                                  <SelectItem value="add:editor">Add Editor</SelectItem>
                                )}
                                {u.roles.includes('editor') && (
                                  <SelectItem value="remove:editor">Remove Editor</SelectItem>
                                )}
                                {!u.roles.includes('reviewer') && (
                                  <SelectItem value="add:reviewer">Add Reviewer</SelectItem>
                                )}
                                {u.roles.includes('reviewer') && (
                                  <SelectItem value="remove:reviewer">Remove Reviewer</SelectItem>
                                )}
                                {!u.roles.includes('buyer') && (
                                  <SelectItem value="add:buyer">Add Buyer</SelectItem>
                                )}
                                {u.roles.includes('buyer') && (
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
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">System settings coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
