import { ResizableSidebarLayout } from "@/components/sidebarcomponents/resizable-sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <ResizableSidebarLayout>
            {children}
        </ResizableSidebarLayout>
    )
}