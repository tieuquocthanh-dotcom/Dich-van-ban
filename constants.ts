
import { Language, Scenario, Dialogue, FriendPersona } from './types';

export const LANGUAGES: Language[] = [
  { code: 'Vietnamese', name: 'Tiếng Việt' },
  { code: 'English', name: 'Tiếng Anh' },
  { code: 'Korean', name: 'Tiếng Hàn' },
  { code: 'Simplified Chinese', name: 'Tiếng Trung (Giản thể)' },
  { code: 'Cantonese', name: 'Tiếng Quảng Đông' },
];

export const FRIEND_PERSONAS: FriendPersona[] = [
  {
    id: 'alex',
    name: 'Alex Miller',
    avatar: '😎',
    tagline: 'Bạn Mỹ hài hước, năng động, thích du lịch & cà phê',
    language: 'English',
    personality: 'Friendly, casual, enthusiastic, uses natural everyday American slang, great sense of humor, loves talking about weekends, hobbies, movies, coffee, and daily life.',
    defaultTopic: 'Hôm nay của bạn thế nào?',
    introMessage: "Hey there! What's up? I'm Alex. Super excited to hang out with you! How has your day been treating you so far?"
  },
  {
    id: 'emma',
    name: 'Emma Watson',
    avatar: '🌸',
    tagline: 'Cô bạn Anh Quốc nhẹ nhàng, biết lắng nghe & tâm sự',
    language: 'English',
    personality: 'Warm, thoughtful, British charm, empathetic listener, loves talking about books, music, deep thoughts, food recipes, and cozy everyday moments.',
    defaultTopic: 'Tâm sự chuyện thường ngày',
    introMessage: "Hello! Lovely to meet you. I was just having a cup of tea. How are things going with you today? Tell me everything!"
  },
  {
    id: 'minjun',
    name: 'Min-jun (민준)',
    avatar: '🎧',
    tagline: 'Anh bạn Seoul sành điệu, đam mê K-Culture & ẩm thực',
    language: 'Korean',
    personality: 'Upbeat Korean friend living in Hongdae Seoul, loves K-dramas, K-pop, street food, weekend trips, and chatting comfortably like close chingu (친구).',
    defaultTopic: 'Ẩm thực & Văn hóa Hàn Quốc',
    introMessage: "안녕! 반가워! 오늘 하루는 어땠어? 맛있는 거 먹었니? 편하게 이야기하자!"
  },
  {
    id: 'xiaoming',
    name: 'Tiểu Minh (小明)',
    avatar: '🥟',
    tagline: 'Người bạn Trung Quốc ấm áp, mê trà sữa & du lịch',
    language: 'Simplified Chinese',
    personality: 'Warm-hearted friend from Shanghai, loves exploring night markets, boba tea, tech gadgets, travel stories, and casual everyday chit-chat.',
    defaultTopic: 'Cuộc sống & Ẩm thực thường ngày',
    introMessage: "嗨！很高兴认识你！今天过得怎么样？有没有什么好玩的事情跟我分享呢？"
  },
  {
    id: 'kawing',
    name: 'A Dĩnh (阿穎)',
    avatar: '🎬',
    tagline: 'Bạn Hồng Kông hóm hỉnh, mê phim ảnh & Dim Sum',
    language: 'Cantonese',
    personality: 'Witty friend from Hong Kong, loves classic cinema, yum cha, dim sum, trendy cafes, and lively urban lifestyle banter.',
    defaultTopic: 'Trà chiều & Phim ảnh Hồng Kông',
    introMessage: "哈囉！你好呀！今日過成點呀？得閒一齊飲茶傾下偈啦！"
  },
  {
    id: 'linh',
    name: 'Phương Linh',
    avatar: '✨',
    tagline: 'Người bạn Việt Nam thân thiện, cùng bạn luyện phản xạ',
    language: 'Vietnamese',
    personality: 'Cực kỳ thân thiện, tâm lý, thích chia sẻ về cuộc sống, công việc, mục tiêu học tập, luôn sẵn sàng lắng nghe và động viên bạn.',
    defaultTopic: 'Góc tâm sự bạn bè',
    introMessage: "Chào bạn nha! Rất vui được làm bạn với bạn nè. Hôm nay có chuyện gì vui hay cần tâm sự không, kể mình nghe với!"
  }
];

export const FRIEND_TOPICS = [
  { id: 'daily', icon: '☕', label: 'Hôm nay thế nào?', prompt: "Let's talk casually about how our day is going, what we did today, and what made us smile." },
  { id: 'food', icon: '🍜', label: 'Món ngon & Ẩm thực', prompt: "Let's chat about our favorite foods, cooking experiments, street food, and what we're craving right now." },
  { id: 'weekend', icon: '🎉', label: 'Kế hoạch cuối tuần', prompt: "Let's discuss weekend plans, favorite chill spots, hanging out with friends, or relaxing at home." },
  { id: 'movies', icon: '🎬', label: 'Phim ảnh & Âm nhạc', prompt: "Let's talk about the best movies, TV shows, songs, or playlists we've discovered recently." },
  { id: 'travel', icon: '✈️', label: 'Du lịch trong mơ', prompt: "Let's talk about dream travel destinations, memorable trips, cultures, and funny travel stories." },
  { id: 'hobbies', icon: '🎨', label: 'Sở thích & Đam mê', prompt: "Let's chat about our personal hobbies, sports, gaming, photography, or new skills we want to learn." },
  { id: 'vent', icon: '💭', label: 'Tâm sự & Giải tỏa', prompt: "Let's have a cozy, heartfelt chat to vent about stress, share honest thoughts, and encourage each other." }
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'travel',
    name: 'Du lịch & Khách sạn',
    icon: '✈️',
    description: 'Tập check-in khách sạn hoặc hỏi đường.',
    initialPrompt: 'You are a hotel receptionist. I am a guest checking in. Start by greeting me professionally.'
  },
  {
    id: 'office',
    name: 'Công sở & Phỏng vấn',
    icon: '💼',
    description: 'Luyện tập phỏng vấn xin việc hoặc họp hành.',
    initialPrompt: 'You are a hiring manager at a tech company. I am a candidate for a Software Engineer position. Start the interview by asking me to introduce myself.'
  },
  {
    id: 'sales',
    name: 'Bán hàng & Mua sắm',
    icon: '🛒',
    description: 'Tư vấn sản phẩm hoặc mặc cả giá.',
    initialPrompt: 'You are a customer looking for a new smartphone. I am the salesperson. Start by asking me for recommendations.'
  },
  {
    id: 'restaurant',
    name: 'Nhà hàng & Ăn uống',
    icon: '🍽️',
    description: 'Gọi món và giao tiếp với phục vụ.',
    initialPrompt: 'You are a waiter at a high-end Italian restaurant. I am a customer. Start by offering me the menu and asking for drinks.'
  },
  {
    id: 'table-tennis',
    name: 'Cửa hàng Bóng bàn',
    icon: '🏓',
    description: 'Tư vấn cốt vợt, mặt vợt và kỹ thuật.',
    initialPrompt: 'You are a professional table tennis equipment expert and shop owner. I am a customer looking to upgrade my paddle. You should provide advice on different types of blades (ALC, ZLC, All-wood) and rubbers (tacky Chinese style vs bouncy European/Japanese style). Start by welcoming me and asking about my playing style: offensive, defensive, or all-round.'
  }
];

export const DIALOGUES: Dialogue[] = [
  {
    id: 'd1',
    title: 'Mua sắm quần áo',
    category: 'Store',
    icon: '🛍️',
    lines: [
      { speaker: 'Clerk', text: 'Hello! Are you looking for anything in particular today?', translation: 'Xin chào! Hôm nay bạn có đang tìm kiếm món đồ cụ thể nào không?' },
      { speaker: 'Customer', text: 'Yes, I am looking for a blue sweater in medium size.', translation: 'Vâng, tôi đang tìm một chiếc áo len màu xanh da trời size M.' },
      { speaker: 'Clerk', text: 'Let me check... Yes, we have one left. Would you like to try it on?', translation: 'Để tôi kiểm tra... Vâng, chúng tôi còn một chiếc. Bạn có muốn thử nó không?' },
      { speaker: 'Customer', text: 'Where are the fitting rooms?', translation: 'Phòng thay đồ ở đâu vậy?' },
      { speaker: 'Clerk', text: 'They are right over there, in the corner.', translation: 'Chúng ở ngay đằng kia, trong góc ấy.' }
    ]
  },
  {
    id: 'd2',
    title: 'Nhận phòng khách sạn',
    category: 'Hotel',
    icon: '🏨',
    lines: [
      { speaker: 'Receptionist', text: 'Welcome to the Grand Plaza. Do you have a reservation?', translation: 'Chào mừng quý khách đến với Grand Plaza. Quý khách đã đặt phòng chưa ạ?' },
      { speaker: 'Guest', text: 'Yes, I booked a double room under the name Nguyen.', translation: 'Vâng, tôi đã đặt một phòng đôi dưới tên Nguyen.' },
      { speaker: 'Receptionist', text: 'Ah, yes. I found it. Could I please see your ID?', translation: 'À vâng. Tôi thấy rồi. Tôi có thể xem giấy tờ tùy thân của bạn được không?' },
      { speaker: 'Guest', text: 'Here it is. Is breakfast included in the price?', translation: 'Đây ạ. Giá phòng đã bao gồm bữa sáng chưa?' },
      { speaker: 'Receptionist', text: 'Yes, breakfast is served from 7 to 10 AM in the main dining room.', translation: 'Vâng, bữa sáng được phục vụ từ 7 đến 10 giờ sáng tại phòng ăn chính.' }
    ]
  },
  {
    id: 'd3',
    title: 'Gọi món tại nhà hàng',
    category: 'Restaurant',
    icon: '🍝',
    lines: [
      { speaker: 'Waiter', text: 'Good evening. Are you ready to order?', translation: 'Chào buổi tối. Quý khách đã sẵn sàng gọi món chưa?' },
      { speaker: 'Customer', text: 'Not quite. What do you recommend?', translation: 'Chưa hẳn. Anh có gợi ý món nào không?' },
      { speaker: 'Waiter', text: 'Our seafood pasta is very popular today.', translation: 'Món mì Ý hải sản của chúng tôi hôm nay rất được ưa chuộng.' },
      { speaker: 'Customer', text: 'That sounds great. I will have that and a glass of red wine.', translation: 'Nghe tuyệt đấy. Tôi sẽ lấy món đó và một ly rượu vang đỏ.' },
      { speaker: 'Waiter', text: 'Excellent choice. I will be right back with your drink.', translation: 'Lựa chọn tuyệt vời. Tôi sẽ quay lại ngay với đồ uống của bạn.' }
    ]
  },
  {
    id: 'd4',
    title: 'Cửa hàng dụng cụ bóng bàn',
    category: 'Store',
    icon: '🏓',
    lines: [
      { speaker: 'Clerk', text: 'Welcome! Are you looking for a pre-assembled paddle or professional components like blades and rubbers?', translation: 'Chào mừng! Bạn đang tìm một cây vợt dán sẵn hay các linh kiện chuyên nghiệp như cốt vợt và mặt vợt?' },
      { speaker: 'Customer', text: 'I need an offensive blade with carbon layers. I want something fast but with good control.', translation: 'Tôi cần một chiếc cốt vợt tấn công có các lớp carbon. Tôi muốn một thứ gì đó nhanh nhưng vẫn kiểm soát tốt.' },
      { speaker: 'Clerk', text: 'This carbon-fiber blade is very popular for high-speed play. Which rubbers would you like to pair it with?', translation: 'Chiếc cốt vợt sợi carbon này rất phổ biến cho lối chơi tốc độ cao. Bạn muốn kết hợp nó với loại mặt vợt nào?' },
      { speaker: 'Customer', text: 'I prefer high-spin rubbers for my forehand. Do you have any tacky Chinese rubbers?', translation: 'Tôi thích mặt vợt có độ xoáy cao cho cú thuận tay. Bạn có loại mặt vợt Tàu nào có độ dính không?' },
      { speaker: 'Clerk', text: 'Yes, we have the latest Hurricane series. They provide excellent spin for aggressive loops.', translation: 'Vâng, chúng tôi có dòng Hurricane mới nhất. Chúng cung cấp độ xoáy tuyệt vời cho những cú giật bóng tấn công.' },
      { speaker: 'Customer', text: 'Perfect. I will take those, and also a professional carrying case for protection.', translation: 'Hoàn hảo. Tôi sẽ lấy chúng, và cả một chiếc bao vợt chuyên nghiệp để bảo vệ nữa.' }
    ]
  }
];
