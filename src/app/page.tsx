import RoomEditor from "@/components/room/RoomEditor";

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Room Buddy</h1>
      <p className="mt-1 text-sm opacity-70">Enter room dimensions, drag furniture, and get layout suggestions.</p>
      <div className="mt-6">
        <RoomEditor />
      </div>
    </main>
  );
}
