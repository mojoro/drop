import { NextResponse } from "next/server";
import { listProfiles, saveProfile, deleteProfile, maskProfile } from "@/lib/storage";

export const runtime = "nodejs";

/** Returns profiles with masked keys — secrets never leave the server. */
export async function GET() {
  const profiles = await listProfiles();
  return NextResponse.json(profiles.map(maskProfile));
}

export async function POST(req: Request) {
  try {
    const profile = await req.json();
    if (!profile?.name) {
      return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
    }
    await saveProfile(profile);
    return NextResponse.json({ ok: true, name: profile.name });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
  }
  const ok = await deleteProfile(name);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
