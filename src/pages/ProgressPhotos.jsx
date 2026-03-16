import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLoader, EmptyState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, Upload, ArrowLeftRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { trackProgressPhotoUploaded } from '@/services/engagementTracker';

export default function ProgressPhotos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [uploadForm, setUploadForm] = useState({
    date_taken: new Date().toISOString().split('T')[0],
    tag: 'front',
    notes: '',
    weight_kg: ''
  });
  const [uploadingFile, setUploadingFile] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.ClientProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id
  });

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['progress-photos', clientProfile?.id],
    queryFn: () => base44.entities.ProgressPhoto.filter({ 
      client_id: clientProfile.id,
      is_deleted: false 
    }, '-date_taken'),
    enabled: !!clientProfile?.id
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      await base44.entities.ProgressPhoto.create({
        client_id: clientProfile.id,
        trainer_id: clientProfile.trainer_id,
        photo_url: file_url,
        date_taken: uploadForm.date_taken,
        tag: uploadForm.tag,
        notes: uploadForm.notes,
        weight_kg: uploadForm.weight_kg ? parseFloat(uploadForm.weight_kg) : null
      });
    },
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries(['progress-photos']);
      toast.success('Photo uploaded!');
      setUploadDialogOpen(false);
      setUploadForm({
        date_taken: new Date().toISOString().split('T')[0],
        tag: 'front',
        notes: '',
        weight_kg: ''
      });
      setUploadingFile(null);
      if (clientProfile?.id) {
        trackProgressPhotoUploaded(clientProfile.id, clientProfile.trainer_id ?? clientProfile.coach_id, { tag: uploadForm.tag }).catch(() => {});
      }
    }
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadingFile(file);
      uploadMutation.mutate(file);
    }
  };

  const togglePhotoSelection = (photo) => {
    if (selectedPhotos.find(p => p.id === photo.id)) {
      setSelectedPhotos(selectedPhotos.filter(p => p.id !== photo.id));
    } else if (selectedPhotos.length < 2) {
      setSelectedPhotos([...selectedPhotos, photo]);
    }
  };

  if (!user || isLoading) return <PageLoader />;

  const tagColors = {
    front: 'bg-blue-500/20 text-blue-400',
    side: 'bg-purple-500/20 text-purple-400',
    back: 'bg-green-500/20 text-green-400',
    other: 'bg-slate-500/20 text-slate-400'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Progress Photos</h1>
            <p className="text-slate-400">{photos.length} photos uploaded</p>
          </div>
          <div className="flex gap-2">
            {photos.length >= 2 && (
              <Button
                onClick={() => setComparisonMode(!comparisonMode)}
                variant="outline"
                className="border-slate-700"
              >
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                {comparisonMode ? 'Exit' : 'Compare'}
              </Button>
            )}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-500 hover:bg-blue-600">
                  <Camera className="w-4 h-4 mr-2" /> Upload Photo
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Upload Progress Photo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Date Taken</label>
                    <Input
                      type="date"
                      value={uploadForm.date_taken}
                      onChange={(e) => setUploadForm({ ...uploadForm, date_taken: e.target.value })}
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Photo Type</label>
                    <Select value={uploadForm.tag} onValueChange={(value) => setUploadForm({ ...uploadForm, tag: value })}>
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="front">Front</SelectItem>
                        <SelectItem value="side">Side</SelectItem>
                        <SelectItem value="back">Back</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Weight (kg) - Optional</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={uploadForm.weight_kg}
                      onChange={(e) => setUploadForm({ ...uploadForm, weight_kg: e.target.value })}
                      placeholder="e.g. 75.5"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Notes - Optional</label>
                    <Textarea
                      value={uploadForm.notes}
                      onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                      placeholder="Any notes about this photo..."
                      className="bg-slate-800 border-slate-700"
                      rows={3}
                    />
                  </div>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploadMutation.isPending}
                    />
                    <Button
                      type="button"
                      className="w-full bg-blue-500 hover:bg-blue-600"
                      disabled={uploadMutation.isPending}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadMutation.isPending ? 'Uploading...' : 'Select & Upload Photo'}
                    </Button>
                  </label>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Comparison Mode */}
      {comparisonMode && (
        <div className="p-4 md:p-6 bg-blue-500/10 border-b border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-400 font-medium">Comparison Mode</p>
              <p className="text-xs text-slate-400">Select 2 photos to compare</p>
            </div>
            {selectedPhotos.length === 2 && (
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                View Comparison
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Photos Grid */}
      <div className="p-4 md:p-6">
        {photos.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="No progress photos yet"
            description="Upload weekly photos to track your transformation visually."
            action={
              <Button 
                onClick={() => setUploadDialogOpen(true)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Camera className="w-4 h-4 mr-2" /> Upload First Photo
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => comparisonMode && togglePhotoSelection(photo)}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  selectedPhotos.find(p => p.id === photo.id)
                    ? 'border-blue-500 scale-95'
                    : 'border-transparent hover:border-slate-600'
                }`}
              >
                <img
                  src={photo.photo_url}
                  alt={`Progress ${photo.date_taken}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <Badge className={tagColors[photo.tag]}>
                    {photo.tag}
                  </Badge>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <p className="text-xs text-white font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(photo.date_taken).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {photo.weight_kg && (
                    <p className="text-xs text-slate-300">{photo.weight_kg} kg</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}