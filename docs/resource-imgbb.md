# How to Upload Images Using ImgBB in Next.js

Uploading images is a common requirement in modern web applications. Instead of storing images directly in your database, you can upload them to a cloud image hosting service like ImgBB and save only the image URL in your database.

In this tutorial, we'll learn how to upload images to ImgBB using a Next.js application.

## Step 1: Create an ImgBB Account

Visit:

https://imgbb.com

Create an account and navigate to the API section.

Generate an API key and copy it.

---

## Step 2: Store the API Key

Create a `.env.local` file in your project root.

```
IMGBB_API_KEY=your_imgbb_api_key_here
```

Restart your development server after adding the environment variable.

```bash
npm run dev
```

---

## Step 3: Create an Image Upload Function

```jsx
const uploadImage = async (imageFile) => {
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (data.success) {
    return data.data.url;
  }

  throw new Error("Image upload failed");
};
```

---

## Step 4: Create File Input

```jsx
<input
  type="file"
  accept="image/*"
  onChange={handleImageUpload}
/>
```

---

## Step 5: Upload Image on Selection

```jsx
const [imageUrl, setImageUrl] = useState("");
const [loading, setLoading] = useState(false);

const handleImageUpload = async (e) => {
  const file = e.target.files[0];

  if (!file) return;

  try {
    setLoading(true);

    const uploadedUrl = await uploadImage(file);

    setImageUrl(uploadedUrl);

    console.log("Uploaded Image URL:", uploadedUrl);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

---

## Step 6: Show Preview

```jsx
{
  imageUrl && (
    <img
      src={imageUrl}
      alt="Preview"
      className="w-32 h-32 object-cover rounded-lg"
    />
  );
}
```

---

## Complete Example

```jsx
"use client";

import { useState } from "react";

export default function ImageUploader() {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setLoading(true);

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        setImageUrl(data.data.url);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
      />

      {loading && <p>Uploading...</p>}

      {imageUrl && (
        <img
          src={imageUrl}
          alt="Uploaded"
          className="w-32 h-32 object-cover rounded-lg mt-4"
        />
      )}
    </div>
  );
}
```

---

## Storing the Image URL in Database

After uploading, ImgBB returns an image URL:

```jsx
https://i.ibb.co/example-image.jpg
```

Save this URL in MongoDB:

```jsx
const productData = {
  name: "Laptop",
  image: imageUrl,
};

await Product.create(productData);
```

Later, you can display the image directly using the stored URL.

---

## Benefits of Using ImgBB

- Free image hosting
- Easy API integration
- Fast image delivery
- No need to store image files in MongoDB
- Simple implementation for beginner projects

This approach is commonly used in MERN Stack and Next.js projects when building products, companies, events, user profiles, and portfolio applications.