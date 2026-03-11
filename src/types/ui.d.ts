/**
 * Type declarations for @/components/ui/* (excluded from tsconfig).
 */
declare module '@/components/ui/button' {
  import type { ForwardRefExoticComponent, RefAttributes, ButtonHTMLAttributes } from 'react';
  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    asChild?: boolean;
  }
  export const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;
  export const buttonVariants: (props: unknown) => string;
}

declare module '@/components/ui/input' {
  import type { ForwardRefExoticComponent, RefAttributes, InputHTMLAttributes } from 'react';
  export type InputProps = InputHTMLAttributes<HTMLInputElement>;
  export const Input: ForwardRefExoticComponent<InputProps & RefAttributes<HTMLInputElement>>;
}

declare module '@/components/ui/textarea' {
  import type { ForwardRefExoticComponent, RefAttributes, TextareaHTMLAttributes } from 'react';
  export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
  export const Textarea: ForwardRefExoticComponent<TextareaProps & RefAttributes<HTMLTextAreaElement>>;
}

declare module '@/components/ui/switch' {
  import type { ForwardRefExoticComponent, RefAttributes } from 'react';
  export interface SwitchProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
  export const Switch: ForwardRefExoticComponent<SwitchProps & RefAttributes<HTMLButtonElement>>;
}

declare module '@/components/ui/badge' {
  import type { ForwardRefExoticComponent, RefAttributes, HTMLAttributes } from 'react';
  export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    variant?: string;
  }
  export const Badge: ForwardRefExoticComponent<BadgeProps & RefAttributes<HTMLDivElement>>;
}

