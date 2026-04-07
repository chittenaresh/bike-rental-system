import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Upload, Plus } from 'lucide-react';
import { settingsAPI, heroImagesAPI } from '@/lib/api';
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';

interface HeroImage {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  order: number;
  isActive: boolean;
}

export function HeroImageManager() {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const loadImages = async () => {
    try {
      setIsLoading(true);
      const data = await heroImagesAPI.getAll();
      setImages(data);
    } catch (error) {
      console.error('Failed to load hero images:', error);
      toast({
        title: "Error",
        description: "Failed to load hero images",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewImageFile(file);
      setNewImagePreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!newImageFile) return;

    try {
      setIsUploading(true);
      // 1. Upload file
      const uploadRes = await settingsAPI.uploadImage(newImageFile);
      
      // 2. Create hero image record
      await heroImagesAPI.create({
        imageUrl: uploadRes.imageUrl,
        title: '',
        subtitle: '',
        order: images.length, // Append to end
        isActive: true
      });

      toast({ title: "Success", description: "Image added successfully" });
      
      // Reset form
      setNewImageFile(null);
      setNewImagePreview(null);
      
      // Reload list
      loadImages();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await heroImagesAPI.delete(id);
      setImages(images.filter(img => img.id !== id));
      toast({ title: "Deleted", description: "Image removed successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await heroImagesAPI.update(id, { isActive: !currentStatus });
      setImages(images.map(img => 
        img.id === id ? { ...img, isActive: !currentStatus } : img
      ));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleOrderChange = async (id: string, newOrder: number) => {
    try {
      await heroImagesAPI.update(id, { order: newOrder });
      setImages(images.map(img => 
        img.id === id ? { ...img, order: newOrder } : img
      ).sort((a, b) => a.order - b.order)); // Ideally re-sort or reload
      loadImages(); // Reload to be safe with sorting
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) return <div className="p-4 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Existing Images List */}
        {images.map((image) => (
          <div key={image.id} className="group relative bg-card border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
            <div className="aspect-video relative bg-muted">
              <img 
                src={image.imageUrl} 
                alt="RideFlow Hero Carousel Image" 
                className={`w-full h-full object-cover transition-opacity ${!image.isActive ? 'opacity-50 grayscale' : ''}`}
              />
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded-lg">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDelete(image.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={image.isActive} 
                    onCheckedChange={() => handleToggleActive(image.id, image.isActive)}
                  />
                  <span className="text-xs text-muted-foreground">{image.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex items-center gap-2">
                   <Label className="text-xs">Order</Label>
                   <Input 
                     type="text" 
                     className="w-16 h-8 text-xs" 
                     value={image.order}
                     onChange={(e) => {
                       const val = e.target.value;
                       if (/^\d*$/.test(val)) {
                         handleOrderChange(image.id, parseInt(val) || 0);
                       }
                     }}
                     onKeyDown={(e) => {
                       if (['e', 'E', '+', '-'].includes(e.key)) {
                         e.preventDefault();
                       }
                     }}
                   />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add New Image Card */}
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-muted/50 transition-colors">
           {!newImageFile ? (
             <div className="text-center space-y-2">
               <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                 <Plus className="h-6 w-6" />
               </div>
               <h3 className="font-medium">Add New Slide</h3>
               <p className="text-xs text-muted-foreground mb-4">Upload an image to add to the carousel</p>
               <Label htmlFor="hero-upload" className="cursor-pointer">
                 <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2">
                    <Upload className="mr-2 h-4 w-4" /> Select Image
                 </div>
                 <Input 
                   id="hero-upload" 
                   type="file" 
                   accept="image/*" 
                   className="hidden" 
                   onChange={handleFileChange}
                 />
               </Label>
             </div>
           ) : (
             <div className="w-full space-y-4">
               <div className="aspect-video relative rounded-lg overflow-hidden bg-muted border">
                 <img src={newImagePreview!} alt="Preview" className="w-full h-full object-cover" />
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full h-6 w-6"
                   onClick={() => {
                     setNewImageFile(null);
                     setNewImagePreview(null);
                   }}
                 >
                   <Trash2 className="h-3 w-3" />
                 </Button>
               </div>
               <Button 
                 className="w-full" 
                 onClick={handleUpload} 
                 disabled={isUploading}
               >
                 {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                 Save Slide
               </Button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
