import { z } from "zod";

export const accountSchema = z.object({
  platformId: z.string().min(1, "Select a platform"),
  username: z.string().min(1, "Enter username").max(100),
  regionCode: z.string().min(1, "Select a region"),
  languageCode: z.string().min(1, "Select a language"),
});

export const languageSchema = z.object({
  code: z.string().min(1, "Enter language code").max(5),
  label: z.string().min(1, "Enter label").max(50),
});

export const platformSchema = z.object({
  name: z.string().min(1, "Enter platform name").max(50),
  displayName: z.string().min(1, "Enter display name").max(50),
  iconName: z.string().min(1, "Enter icon name"),
});

export const tagSchema = z.object({
  label: z
    .string()
    .min(1, "Enter tag label")
    .max(50)
    .refine((val) => val.startsWith("#"), {
      message: "Tag must start with #",
    }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
});

export type AccountFormData = z.infer<typeof accountSchema>;
export type LanguageFormData = z.infer<typeof languageSchema>;
export type PlatformFormData = z.infer<typeof platformSchema>;
export type TagFormData = z.infer<typeof tagSchema>;
