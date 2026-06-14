<IMAGE_UPLOAD_REQUIREMENTS>
* IMAGE REQUIREMENT DETECTION:
  - Treat the system as requiring image upload functionality when the user explicitly or implicitly mentions: "image", "picture", "photo", "avatar", "banner", "thumbnail", "upload image", "manage pictures".
  - If any table contains image fields or any feature requires uploading, editing, or managing images, an **image upload subsystem** must be included.

* IMAGE PLATFORM & ARCHITECTURE RULES:
  1. **Mandatory Supabase Storage**
     - All image uploads must use **Supabase Storage** buckets.
     - Buckets must be created using `supabase_apply_migration`.
  2. **Bucket Policies**
     - Images usually don't require access control.
     - For private scenarios, generate a signed URL when loading images.
  3. **File Size & Format**
     - By default, the maximum upload size must be enforced according to the bucket configuration (default: **1 MB**).
     - If users attempt to upload files exceeding the limit, an **automatic compression strategy must be triggered**:
       - Convert images to **WEBP** format.
       - Restrict maximum resolution to **1080p** (preserve aspect ratio).
       - Apply quality setting = **0.8** and auto-degrade iteratively until the file size is below 1 MB.
     - Supported formats for upload: JPEG, PNG, GIF, WEBP, AVIF.
     - Filename Rules: Ensure that the uploaded file's name contains only English letters and numbers.
* ADDITIONAL FRONTEND INTEGRATION RULES:
  - A clear **Upload Button** must be designed.
    - Display **upload progress bar** in real-time.
    - Notify users explicitly on **upload success** or **failure**.
    - If compression is applied:
      - Inform users that the image was compressed automatically.
      - Display the **final file size** after compression in the confirmation message.

* IMAGE IMPLEMENTATION WORKFLOW
### Step 1: Initialize Supabase
- Ensure Supabase is properly initialized and connected to the frontend.

### Step 2: Bucket & Database Setup
- Use `supabase_apply_migration` to create a dedicated image bucket.
- Modify relevant tables to store image URLs/paths.
- Apply appropriate policies for read/write access.

### Step 3: File Validation
- Validate file size, type, and dimensions before upload.
- If the file exceeds the maximum allowed size, trigger the **automatic compression strategy** to reduce size to under 1 MB.

### Step 4: Frontend Implementation
- Implement the upload button with progress bar.
- Show **upload success/failure notification**.
- If compression was applied, notify the user and show the **compressed file size**.

### Step 5: User Guidance
- Provide clear instructions to the user about supported file formats and maximum size.
- Inform users about the automatic compression mechanism.

</IMAGE_UPLOAD_REQUIREMENTS>
