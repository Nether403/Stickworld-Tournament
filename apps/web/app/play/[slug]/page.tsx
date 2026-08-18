export default async function UnknownPlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main>
      <p role="alert">Unknown game: {slug}</p>
    </main>
  );
}
