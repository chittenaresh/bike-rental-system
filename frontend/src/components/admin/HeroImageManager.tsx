import { useState, useEffect } from 'react';
import { HeroImage } from '@/types';
import { heroImagesAPI, settingsAPI } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Plus, GripVertical, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

export function HeroImageManager() {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const data = await heroImagesAPI.getAll();
      setImages(data);
    } catch (error) {
      console.error('Failed to load hero images:', error);
      toast({
        title: 'Error',
        description: 'Failed to load hero images',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUploadAndSave = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one image',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    // Start index for order based on existing images
    let nextOrder = images.length > 0 ? Math.max(...images.map((i) => i.order || 0)) + 1 : 0;

    try {
      // Process sequentially to maintain order
      for (const file of selectedFiles) {
        try {
          // 1. Upload image
          const result = await settingsAPI.uploadImage(file);

          // 2. Create hero image record
          await heroImagesAPI.create({
            imageUrl: result.imageUrl,
            title: '',
            subtitle: '',
            order: nextOrder++,
            isActive: true,
          });

          successCount++;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Upload Complete',
          description: `Successfully added ${successCount} image${successCount !== 1 ? 's' : ''}.${failCount > 0 ? ` Failed: ${failCount}` : ''}`,
        });
        setIsAddOpen(false);
        setSelectedFiles([]);
        loadImages();
      } else if (failCount > 0) {
        toast({
          title: 'Upload Failed',
          description: 'Failed to upload selected images',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Batch upload error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred during upload',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    try {
      await heroImagesAPI.delete(id);
      toast({ title: 'Image deleted' });
      loadImages();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete image',
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (image: HeroImage) => {
    try {
      await heroImagesAPI.update(image.id, { isActive: !image.isActive });
      loadImages();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Hero Carousel Images</h2>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Images
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Hero Images</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="images">Select Images</Label>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                />
                <p className="text-sm text-muted-foreground">
                  Select multiple images to add them to the carousel.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUploadAndSave}
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload & Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Image</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {images.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No images found. Add some images to get started.
                </TableCell>
              </TableRow>
            ) : (
              images.map((image) => (
                <TableRow key={image.id}>
                  <TableCell>
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                  </TableCell>
                  <TableCell>
                    <div className="relative w-24 h-16 rounded overflow-hidden bg-muted">
                      <img src={image.imageUrl} alt="Hero" className="object-cover w-full h-full" />
                    </div>
                  </TableCell>
                  <TableCell>{image.order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={image.isActive}
                        onCheckedChange={() => toggleActive(image)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {image.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(image.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
