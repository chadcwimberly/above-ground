-- Human-readable device names ("Red Piano Gnome"): adjective + noun + noun, unique, assigned once by the database.
-- `nickname` stays as the optional admin-set label.
create or replace function public.generate_device_name()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  adj text[] := array['Amber','Bouncy','Breezy','Brave','Bright','Calm','Cheery','Cosy','Crimson','Curious','Dapper','Dreamy',
    'Fluffy','Fuzzy','Gentle','Giddy','Golden','Happy','Jolly','Kind','Lucky','Mellow','Merry','Misty','Nimble','Peachy',
    'Plucky','Polished','Quiet','Rosy','Rustic','Sandy','Silver','Sleepy','Snug','Sparkly','Speckled','Spry','Stable',
    'Steady','Sunny','Swift','Teal','Tidy','Toasty','Velvet','Violet','Warm','Wavy','Whimsical','Wise','Zesty','Red','Blue',
    'Green','Mossy','Cozy','Lunar','Starry','Cloudy','Tiny','Mighty','Jazzy','Witty'];
  thing text[] := array['Acorn','Anchor','Apricot','Banjo','Biscuit','Blanket','Bonnet','Cactus','Canoe','Cello','Clover',
    'Comet','Cookie','Cupcake','Daisy','Drum','Feather','Fern','Fiddle','Garden','Harbor','Kettle','Kite','Lantern','Lemon',
    'Maple','Meadow','Mitten','Muffin','Noodle','Orchard','Pebble','Pepper','Piano','Pickle','Pillow','Pinecone','Pretzel',
    'Pudding','Quilt','Rainbow','Ribbon','Rocket','Saddle','Scone','Sock','Sprout','Sweater','Teacup','Thimble','Trumpet',
    'Tulip','Tuba','Unicorn','Velvet','Waffle','Willow','Yarn','Marble','Moon','Cloud','Banana','Clock','Tugboat'];
  who text[] := array['Badger','Beacon','Bear','Boots','Comet','Dragon','Duckling','Falcon','Ferret','Fox','Gnome','Goggles',
    'Goose','Hedgehog','Heron','Koala','Llama','Lynx','Marmot','Moose','Narwhal','Newt','Otter','Owl','Panda','Parrot',
    'Pelican','Penguin','Pilot','Pony','Puffin','Quokka','Rabbit','Raccoon','Robin','Sailor','Seal','Sloth','Sparrow',
    'Squirrel','Tortoise','Toucan','Walrus','Wizard','Wombat','Wren','Yak','Zebra','Captain','Gardener','Baker','Ranger',
    'Explorer','Dreamer','Scout','Whale','Kitten','Puppy','Turtle','Lark','Finch','Beetle','Dolphin','Hummingbird'];
  n text;
begin
  for i in 1..25 loop
    n := adj[1 + floor(random() * array_length(adj, 1))::int] || ' ' ||
         thing[1 + floor(random() * array_length(thing, 1))::int] || ' ' ||
         who[1 + floor(random() * array_length(who, 1))::int];
    if split_part(n, ' ', 1) <> split_part(n, ' ', 2)
       and not exists (select 1 from public.devices d where d.name = n) then
      return n;
    end if;
  end loop;
  -- Practically unreachable (~260k combinations); keep it unique anyway.
  return n || ' ' || (100 + floor(random() * 900)::int);
end;
$$;

alter table public.devices add column name text;

-- Name is always set by the database on first insert; clients can't choose or change it.
create or replace function public.devices_assign_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := public.generate_device_name();
  return new;
end;
$$;
create trigger devices_assign_name before insert on public.devices
  for each row execute function public.devices_assign_name();

update public.devices set name = public.generate_device_name() where name is null;
alter table public.devices alter column name set not null;
alter table public.devices add constraint devices_name_key unique (name);

revoke all on function public.generate_device_name() from public, anon, authenticated;
revoke all on function public.devices_assign_name() from public, anon, authenticated;
