import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Crown, HelpCircle, Settings, Users, LogOut, Edit, Trash2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Faq, SystemSetting } from "@shared/schema";

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  const { data: faqs, isLoading: faqsLoading } = useQuery<Faq[]>({
    queryKey: ["/api/faqs"],
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  const createFaqMutation = useMutation({
    mutationFn: async (faq: { question: string; answer: string }) => {
      await apiRequest("POST", "/api/admin/faqs", faq);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setNewFaq({ question: "", answer: "" });
      toast({
        title: "Success",
        description: "FAQ created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create FAQ",
        variant: "destructive",
      });
    },
  });

  const updateFaqMutation = useMutation({
    mutationFn: async (faq: any) => {
      await apiRequest("PATCH", `/api/admin/faqs/${faq.id}`, {
        question: faq.question,
        answer: faq.answer,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      setEditingFaq(null);
      toast({
        title: "Success",
        description: "FAQ updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update FAQ",
        variant: "destructive",
      });
    },
  });

  const deleteFaqMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/faqs/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faqs"] });
      toast({
        title: "Success",
        description: "FAQ deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete FAQ",
        variant: "destructive",
      });
    },
  });

  const handleCreateFaq = () => {
    if (newFaq.question.trim() && newFaq.answer.trim()) {
      createFaqMutation.mutate(newFaq);
    }
  };

  const handleUpdateFaq = () => {
    if (editingFaq && editingFaq.question.trim() && editingFaq.answer.trim()) {
      updateFaqMutation.mutate(editingFaq);
    }
  };

  const handleDeleteFaq = (id: string) => {
    if (confirm("Are you sure you want to delete this FAQ?")) {
      deleteFaqMutation.mutate(id);
    }
  };

  return (
    <div className="min-h-screen bg-soft-gray">
      {/* Admin Header */}
      <div className="bg-regis-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-regis-gold rounded-lg flex items-center justify-center mr-4">
              <Crown className="text-regis-navy" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Super Admin Panel</h1>
              <p className="text-blue-200 text-sm">St. Regis Osaka Valet Management</p>
            </div>
          </div>
          <a href="/api/logout" className="text-blue-200 hover:text-white">
            <LogOut className="mr-2 inline-block" size={18} />
            Logout
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* FAQ Management */}
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-regis-navy mb-6 flex items-center">
                <HelpCircle className="mr-3 text-regis-gold" size={20} />
                FAQ Management
              </h2>

              {/* FAQ List */}
              <div className="space-y-4 mb-6">
                {faqsLoading ? (
                  <div>Loading FAQs...</div>
                ) : faqs?.length === 0 ? (
                  <div className="text-gray-500 text-center py-4">No FAQs found</div>
                ) : (
                  faqs?.map((faq: any) => (
                    <div key={faq.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{faq.question}</h3>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingFaq(faq)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteFaq(faq.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{faq.answer}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add New FAQ */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full border-2 border-dashed border-gray-300 hover:border-regis-gold hover:text-regis-gold"
                  >
                    <Plus className="mr-2" size={16} />
                    Add New FAQ
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New FAQ</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Question"
                      value={newFaq.question}
                      onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                    />
                    <Textarea
                      placeholder="Answer"
                      value={newFaq.answer}
                      onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                    />
                    <Button 
                      onClick={handleCreateFaq}
                      className="w-full bg-regis-navy hover:bg-blue-900"
                      disabled={createFaqMutation.isPending}
                    >
                      Create FAQ
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-regis-navy mb-6 flex items-center">
                <Settings className="mr-3 text-regis-gold" size={20} />
                System Settings
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Average Retrieval Time (minutes)
                  </label>
                  <Input type="number" defaultValue="5" min="1" max="30" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Queue Size
                  </label>
                  <Input type="number" defaultValue="20" min="5" max="100" />
                </div>

                <Button className="w-full bg-regis-navy hover:bg-blue-900">
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit FAQ Dialog */}
      {editingFaq && (
        <Dialog open={!!editingFaq} onOpenChange={() => setEditingFaq(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit FAQ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Question"
                value={editingFaq.question}
                onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
              />
              <Textarea
                placeholder="Answer"
                value={editingFaq.answer}
                onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
              />
              <Button 
                onClick={handleUpdateFaq}
                className="w-full bg-regis-navy hover:bg-blue-900"
                disabled={updateFaqMutation.isPending}
              >
                Update FAQ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
