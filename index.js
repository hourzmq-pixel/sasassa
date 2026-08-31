const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    PermissionsBitField, 
    ChannelType, 
    AuditLogEvent 
} = require('discord.js');
const express = require('express');

// Render 7/24 açık tutmak için web sunucusu
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('RMT Log Bot aktif ve çalışıyor!'));
app.listen(PORT, () => console.log(`Web sunucusu ${PORT} portunda çalışıyor.`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

// Basit bellek tabanlı log kanal sistemi
const logChannels = new Map(); // guildId -> channelId

client.once('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı! RMT Log Bot hazır.`);
    client.user.setActivity('Road Master Turkey Logs', { type: 3 });
});

// --- R!SETUP KOMUTU ---
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const prefix = 'r!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Yetki kontrolü (Yönetici)
    if (command === 'setup') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Bu komutu kullanmak için **Yönetici** yetkisine sahip olmalısın.');
        }

        const logChannel = message.mentions.channels.first() || message.channel;
        logChannels.set(message.guild.id, logChannel.id);

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🛡️ RMT Log Sistemi Aktifleştirildi')
            .setDescription(`Başarılı bir şekilde log kanalı <#${logChannel.id}> olarak ayarlandı!\n\nArtık sunucudaki tüm moderasyon, kanal, rol ve mesaj hareketleri bu kanala düşecek.`)
            .addFields(
                { name: 'Takip Edilen Olaylar', value: '• Ban / Kick / Mute\n• Mesaj Düzenleme / Silme\n• Kanal Ekleme / Silme\n• Rol Ekleme / Silme / Verme / Kaldırma' }
            )
            .setFooter({ text: 'RMT | Road Master Turkey - Güvenlik Sistemi', iconURL: message.guild.iconURL() })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
});

// Yardımcı fonksiyon: Log kanalını getir
function getLogChannel(guild) {
    const channelId = logChannels.get(guild.id);
    if (!channelId) return null;
    return guild.channels.cache.get(channelId);
}

// ================= LOG SİSTEMLERİ =================

// 1. MESAJ SİLME
client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;
    const logChannel = getLogChannel(message.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#ed4245')
        .setTitle('🗑️ Mesaj Silindi')
        .addFields(
            { name: 'Yazan', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
            { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
            { name: 'İçerik', value: message.content ? (message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content) : '*İçerik bulunmuyor (Görsel/Embed)*' }
        )
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 2. MESAJ DÜZENLEME
client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const logChannel = getLogChannel(newMessage.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#fee75c')
        .setTitle('✏️ Mesaj Düzenlendi')
        .addFields(
            { name: 'Kullanıcı', value: `<@${newMessage.author.id}>`, inline: true },
            { name: 'Kanal', value: `<#${newMessage.channel.id}>`, inline: true },
            { name: 'Eski Hali', value: oldMessage.content || '*Bilinmiyor*', inline: false },
            { name: 'Yeni Hali', value: newMessage.content || '*Bilinmiyor*', inline: false }
        )
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 3. KANAL OLUŞTURMA
client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    const logChannel = getLogChannel(channel.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#57f287')
        .setTitle('📁 Kanal Oluşturuldu')
        .setDescription(`**Kanal Adı:** ${channel.name}\n**Tür:** ${channel.type === ChannelType.GuildText ? 'Yazı' : channel.type === ChannelType.GuildVoice ? 'Ses' : 'Diğer'}`)
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 4. KANAL SİLME
client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    const logChannel = getLogChannel(channel.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#ed4245')
        .setTitle('🗑️ Kanal Silindi')
        .setDescription(`**Kanal Adı:** ${channel.name}`)
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 5. ROL OLUŞTURMA
client.on('roleCreate', async role => {
    const logChannel = getLogChannel(role.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#57f287')
        .setTitle('🏷️ Rol Oluşturuldu')
        .setDescription(`**Rol Adı:** ${role.name}`)
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 6. ROL SİLME
client.on('roleDelete', async role => {
    const logChannel = getLogChannel(role.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#ed4245')
        .setTitle('🏷️ Rol Silindi')
        .setDescription(`**Rol Adı:** ${role.name}`)
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 7. ÜYE ROL VE MUTE/TIMEOUT GÜNCELLEMELERİ (Tek Çatıda Birleştirildi)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const logChannel = getLogChannel(newMember.guild);
    if (!logChannel) return;

    // Rol Verme Kontrolü
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    if (addedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setColor('#57f287')
            .setTitle('➕ Kullanıcıya Rol Verildi')
            .setDescription(`**Kullanıcı:** <@${newMember.id}>\n**Verilen Rol(ler):** ${addedRoles.map(r => r.name).join(', ')}`)
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // Rol Kaldırma Kontrolü
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
    if (removedRoles.size > 0) {
        const embed = new EmbedBuilder()
            .setColor('#ed4245')
            .setTitle('➖ Kullanıcıdan Rol Kaldırıldı')
            .setDescription(`**Kullanıcı:** <@${newMember.id}>\n**Alınan Rol(ler):** ${removedRoles.map(r => r.name).join(', ')}`)
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // Timeout (Mute) Verildi Logu
    if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
        const embed = new EmbedBuilder()
            .setColor('#fee75c')
            .setTitle('🔇 Kullanıcıya Zaman Aşımı (Mute) Verildi')
            .setDescription(`**Kullanıcı:** <@${newMember.id}>\n**Bitiş Tarihi:** <t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`)
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    } 
    // Timeout (Mute) Kaldırıldı Logu
    else if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
        const embed = new EmbedBuilder()
            .setColor('#57f287')
            .setTitle('🔊 Kullanıcının Zaman Aşımı (Mute) Kaldırıldı')
            .setDescription(`**Kullanıcı:** <@${newMember.id}>`)
            .setTimestamp();
        logChannel.send({ embeds: [embed] }).catch(() => {});
    }
});

// 8. BAN ATILMASI
client.on('guildBanAdd', async ban => {
    const logChannel = getLogChannel(ban.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setColor('#ed4245')
        .setTitle('🔨 Kullanıcı Banlandı')
        .setDescription(`**Kullanıcı:** ${ban.user.tag} (<@${ban.user.id}>)`)
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// 9. KICK (SUNUCUDAN ATILMA) LOGU
client.on('guildMemberRemove', async member => {
    const logChannel = getLogChannel(member.guild);
    if (!logChannel) return;

    try {
        const fetchedLogs = await member.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberKick,
        });
        const kickLog = fetchedLogs.entries.first();

        if (kickLog && kickLog.target.id === member.id && (Date.now() - kickLog.createdTimestamp < 5000)) {
            const embed = new EmbedBuilder()
                .setColor('#ed4245')
                .setTitle('👢 Kullanıcı Atıldı (Kick)')
                .setDescription(`**Atılan:** ${member.user.tag} (<@${member.id}>)\n**Atan Yetkili:** <@${kickLog.executor.id}>`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    } catch (err) {
        // Denetim kaydı okunamazsa sessizce geç
    }
});

// Bot Girişi (Render Environment değişkeninden alır)
client.login(process.env.TOKEN);