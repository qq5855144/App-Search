<IMAGE_UPLOAD_REQUIREMENTS>
* IMAGE PLATFORM & ARCHITECTURE RULES:
  1. **Mandatory Supabase Storage**
     - All image uploads must use Supabase Storage buckets
     - Buckets must be created using `supabase_apply_migration`
     - Naming convention: `<APP_ID>_<BUSINESS_NAME>_images`
     - CRITICAL: Never use mock URLs or local temp paths as final image URLs
  2. **Bucket Policies**
     - If no login system: all users must be granted permission to upload images
     - If login system exists: authenticated users/admins must be granted permission to upload images
  3. **File Size & Format**
     - No file size limit enforced — always compress before upload with fixed parameters
     - Compression strategy (applied to ALL images before upload):
       - Use `expo-image-manipulator` to resize and compress
       - Restrict maximum resolution to 1080p (preserve aspect ratio; skip resize if original is smaller)
       - JPEG: apply quality = 0.8; PNG: lossless (preserve transparency)
     - Supported formats: JPEG, PNG
     - Filename Rules: Only English letters, numbers, and hyphens allowed
     - Unique file paths: `images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

* ADDITIONAL FRONTEND INTEGRATION RULES:
  - Design clear **Upload Button** with loading state to prevent duplicate submissions
  - Display **upload progress indication** (use indeterminate progress bar since Supabase SDK does not support progress callbacks)
  - Notify users explicitly on **upload success** or **failure** (with retry option on failure)
  - Permission denial must be handled via **state-driven UI** (inline text), NOT `Alert.alert`

* FILE UPLOAD IMPLEMENTATION GUIDELINES:

  1. **Image Picking — `expo-image-picker`**
     ```tsx
     import * as ImagePicker from "expo-image-picker";

     // From camera
     const takePhoto = async () => {
       const { status } = await ImagePicker.requestCameraPermissionsAsync();
       if (status !== "granted") {
         setPermissionDenied(true);
         return;
       }
       const result = await ImagePicker.launchCameraAsync({
         allowsEditing: true,
         quality: 1,
       });
       if (!result.canceled) {
         return result.assets[0];
       }
     };

     // From gallery
     const pickImage = async () => {
       const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
       if (status !== "granted") {
         setPermissionDenied(true);
         return;
       }
       const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ["images"],
         allowsEditing: true,
         quality: 1,
       });
       if (!result.canceled) {
         return result.assets[0];
       }
     };
     ```

  2. **Image Compression — `expo-image-manipulator`**
     ALWAYS compress before upload, preserving original format:
     ```tsx
     import ImageManipulator, { SaveFormat } from "expo-image-manipulator";

     const compressImage = async (
       uri: string,
       mimeType?: string,
       width?: number
     ): Promise<{ uri: string; format: SaveFormat }> => {
       const isPng = mimeType === "image/png";
       const format = isPng ? SaveFormat.PNG : SaveFormat.JPEG;

       const context = ImageManipulator.manipulate(uri);

       // Only resize if original width exceeds 1080
       if (width && width > 1080) {
         context.resize({ width: 1080 });
       }

       const imageRef = await context.renderAsync();
       const result = await imageRef.saveAsync({
         compress: isPng ? 1 : 0.8,
         format,
       });

       return { uri: result.uri, format };
     };
     ```

     Notes:
     - PNG preserves transparency, use `compress: 1` (PNG is lossless, compress parameter is ignored but set explicitly for clarity)
     - JPEG uses `compress: 0.8` for size reduction
     - Format is determined from `asset.mimeType` returned by ImagePicker
     - `width` comes from `asset.width` — skip resize if image is already ≤ 1080px to avoid upscaling
     - DO NOT use deprecated `manipulateAsync` — use the chainable `ImageManipulator.manipulate()` API

     Recommended defaults:
     - General photos: `width: 1080`, `compress: 0.8`, JPEG
     - Avatars/thumbnails: `width: 300`, `compress: 0.6`, JPEG
     - Screenshots/icons with transparency: `width: 1080`, PNG

  3. **Image Upload to Supabase Storage — `expo-file-system` + ArrayBuffer**
     ```tsx
     import * as FileSystem from "expo-file-system";
     import { decode } from "base64-arraybuffer";

     const uploadImage = async (
       uri: string,
       bucket: string,
       path: string,
       mimeType: string = "image/jpeg"
     ) => {
       const base64 = await FileSystem.readAsStringAsync(uri, {
         encoding: FileSystem.EncodingType.Base64,
       });
       const arrayBuffer = decode(base64);
       const { data, error } = await supabase.storage
         .from(bucket)
         .upload(path, arrayBuffer, {
           contentType: mimeType,
           upsert: false,
         });
       if (error) throw error;
       return data;
     };
     ```

     Note: Use `base64-arraybuffer` package (`pnpm add base64-arraybuffer`) to convert Base64 string to ArrayBuffer. Do NOT use `expo/fetch` for reading local file URIs — it is designed for HTTP streaming, not local file access.

  4. **Complete Upload Flow with Error Handling**
     ```tsx
     const [uploading, setUploading] = useState(false);

     const handleUpload = async (asset: ImagePicker.ImagePickerAsset) => {
       if (uploading) return; // Prevent duplicate submissions
       setUploading(true);

       try {
         // Always compress before upload, preserving format
         const { uri: compressedUri, format } = await compressImage(
           asset.uri,
           asset.mimeType,
           asset.width
         );

         const ext = format === SaveFormat.PNG ? "png" : "jpg";
         const mimeType = format === SaveFormat.PNG ? "image/png" : "image/jpeg";
         const fileName = `images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
         const data = await uploadImage(compressedUri, BUCKET_NAME, fileName, mimeType);

         // Success: store data.path in database
       } catch (error) {
         // Show retry option to user
       } finally {
         setUploading(false);
       }
     };
     ```

  5. **Image Display — `expo-image`**
     ```tsx
     import { Image } from "expo-image";

     // Local preview (before upload)
     <Image
       className="w-full h-48 rounded-xl object-cover"
       source={{ uri: localUri }}
       transition={200}
     />

     // Remote display (after upload)
     const { data: { publicUrl } } = supabase.storage
       .from(bucket)
       .getPublicUrl(storedPath);

     <Image
       className="w-full h-48 rounded-xl object-cover"
       source={{ uri: publicUrl }}
       placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
       transition={200}
     />
     ```

  6. **Store path in database, convert to URL for display**
     - `data.path` from upload is a relative path like `images/1717400000_abc123.jpg`
     - Always store `path` in the database
     - Convert to public URL when displaying: `supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl`

  7. **Permission Handling — State-Driven UI**
     ```tsx
     const [permissionDenied, setPermissionDenied] = useState(false);

     {permissionDenied && (
       <Text className="text-destructive text-sm mt-2">
         Photo library access is required. Please enable it in Settings.
       </Text>
     )}
     ```
     NEVER use `Alert.alert` for permission denial — use inline state-driven text.

* app.json PERMISSION DECLARATIONS:
  Permission descriptions MUST be in the user's language:
  ```json
  {
    "expo": {
      "plugins": [
        ["expo-image-picker", {
          "cameraPermission": "<TRANSLATE: Allow $(PRODUCT_NAME) to access the camera to take photos>",
          "photosPermission": "<TRANSLATE: Allow $(PRODUCT_NAME) to access the photo library to select images>"
        }]
      ]
    }
  }
  ```

* CRITICAL RULES:
  - NEVER use `Alert.alert` — use state-driven UI for all user notifications
  - NEVER pass URI via expo-router URL params — use a module-level store if passing between screens
  - ALWAYS compress before upload (preserve original format: JPEG→JPEG with 0.8 quality, PNG→PNG lossless; only resize if width > 1080 to avoid upscaling)
  - ALWAYS use `expo-file-system` + `base64-arraybuffer` for reading local file URIs into ArrayBuffer (NOT `expo/fetch`)
  - ALWAYS use `expo-image` (not React Native `Image`) for display
  - ALWAYS disable upload button during upload (prevent duplicate submissions)
  - ALWAYS provide error handling with retry option for upload failures
</IMAGE_UPLOAD_REQUIREMENTS>
