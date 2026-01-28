"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountManager } from "./AccountManager";
import { LanguageManager } from "./LanguageManager";
import { PlatformManager } from "./PlatformManager";
import { TagManager } from "./TagManager";

interface ManageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ManageSheet = ({ open, onOpenChange }: ManageSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage accounts, languages, platforms, and tags.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <Tabs defaultValue="accounts">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
              <TabsTrigger value="languages">Target Lang.</TabsTrigger>
              <TabsTrigger value="platforms">Platforms</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="mt-4">
              <AccountManager />
            </TabsContent>

            <TabsContent value="languages" className="mt-4">
              <LanguageManager />
            </TabsContent>

            <TabsContent value="platforms" className="mt-4">
              <PlatformManager />
            </TabsContent>

            <TabsContent value="tags" className="mt-4">
              <TagManager />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
