import { z } from 'zod';

// Authentication validation schema
export const authSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional()
});

export const signInSchema = authSchema.pick({ email: true, password: true });
export const signUpSchema = authSchema;

// Listing creation validation schema
export const listingSchema = z.object({
  title: z.string()
    .trim()
    .min(10, 'Title must be at least 10 characters')
    .max(200, 'Title must be less than 200 characters'),
  description: z.string()
    .trim()
    .min(50, 'Description must be at least 50 characters')
    .max(5000, 'Description must be less than 5000 characters'),
  industry: z.string()
    .min(1, 'Please select an industry'),
  location: z.string()
    .trim()
    .min(2, 'Location is required')
    .max(200, 'Location must be less than 200 characters'),
  companyName: z.string()
    .trim()
    .min(1, 'Company name is required')
    .max(200, 'Company name must be less than 200 characters'),
  companyWebsite: z.string()
    .trim()
    .max(500, 'URL must be less than 500 characters')
    .optional()
    .refine((val) => !val || val.length === 0 || /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/.test(val), {
      message: 'Invalid URL format'
    }),
  revenue: z.number().positive('Revenue must be a positive number').optional(),
  ebitda: z.number().optional(),
  askingPrice: z.number().positive('Asking price must be a positive number').optional(),
  visibilityLevel: z.enum(['public', 'private'], {
    errorMap: () => ({ message: 'Please select a valid visibility level' })
  })
});

export type AuthFormData = z.infer<typeof authSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type ListingFormData = z.infer<typeof listingSchema>;
